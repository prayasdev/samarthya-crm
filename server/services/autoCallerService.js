import twilio from 'twilio';
import dotenv from 'dotenv';
import UploadDetails from '../models/uploadDetails.js';
import Calls from '../models/callHistory.js';
import TaskDetails from '../models/createTask.js';
import Campaign from '../models/campaign.js';

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Store active campaign intervals
const activeCampaigns = new Map();
const CONCURRENT_CALLS = 5;
const BATCH_DELAY = 10000;

export const startAutoCaller = async (campaignId) => {
  try {
    if (activeCampaigns.has(campaignId)) {
      return {
        success: false,
        message: 'Auto-caller already running for this campaign'
      };
    }

    const campaign = await Campaign.findOne({ campaignId }).populate('taskId');
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    campaign.status = 'running';
    campaign.startedAt = new Date();
    await campaign.save();

    console.log(`✓ Auto-caller started for campaign: ${campaignId}`);
    processCalls(campaignId);

    return {
      success: true,
      message: 'Auto-caller started successfully',
      campaignId
    };
  } catch (error) {
    console.error('Error starting auto-caller:', error);
    throw error;
  }
};

export const stopAutoCaller = async (campaignId) => {
  try {
    if (activeCampaigns.has(campaignId)) {
      clearTimeout(activeCampaigns.get(campaignId));
      activeCampaigns.delete(campaignId);
    }

    const campaign = await Campaign.findOne({ campaignId });
    if (campaign) {
      campaign.status = 'paused';
      await campaign.save();
    }

    console.log(`⏸️ Auto-caller paused for campaign: ${campaignId}`);
    return {
      success: true,
      message: 'Auto-caller stopped',
      campaignId
    };
  } catch (error) {
    console.error('Error stopping auto-caller:', error);
    throw error;
  }
};

// Process calls in batches of 5
// Process calls in batches of 5 - FIX: Handle null values
const processCalls = async (campaignId) => {
  try {
    const campaign = await Campaign.findOne({ campaignId }).populate('taskId');

    if (!campaign || campaign.status !== 'running') {
      stopAutoCaller(campaignId);
      return;
    }

    console.log(`\n📞 Processing calls for campaign: ${campaignId}`);
    console.log(`📋 Task ID: ${campaign.taskId._id}`);

    // Get total count
    const totalUploadDetails = await UploadDetails.countDocuments({
      taskId: campaign.taskId._id
    });
    console.log(`📊 Total contacts in UploadDetails: ${totalUploadDetails}`);

    if (totalUploadDetails === 0) {
      console.log('❌ No contacts found in UploadDetails for this taskId!');
      await completeCampaign(campaignId);
      return;
    }

    // Get all contacts
    const allContacts = await UploadDetails.find({
      taskId: campaign.taskId._id
    });

    console.log(`✅ Found ${allContacts.length} total contacts`);

    // Get already called contact IDs - FIX: Handle null values
    const calledContactIds = await Calls.find({
      customer_id: { $exists: true, $ne: null }  // Exclude null values
    }).select('customer_id').lean();

    const calledIds = new Set(
      calledContactIds
        .map(c => c.customer_id?.toString()) // FIX: Use optional chaining
        .filter(id => id !== undefined) // Filter out undefined
    );

    console.log(`📌 Already called: ${calledIds.size} contacts`);

    // Filter to get contacts that haven't been called yet
    const contactsToCall = allContacts
      .filter(contact => !calledIds.has(contact._id.toString()))
      .slice(0, CONCURRENT_CALLS);

    console.log(`🔔 Ready to call: ${contactsToCall.length} contacts`);

    if (contactsToCall.length === 0) {
      console.log('✅ All contacts called for campaign: ' + campaignId);
      await completeCampaign(campaignId);
      return;
    }

    console.log('📱 Initiating calls to:');
    contactsToCall.forEach(contact => {
      console.log(`  ✓ ${contact.name} - ${contact.phoneNo}`);
    });

    // Make 5 parallel calls
    const callPromises = contactsToCall.map(contact =>
      makeCall(contact, campaign)
    );
    const results = await Promise.allSettled(callPromises);

    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;
    console.log(`📊 Batch result: ${successful} successful, ${failed} failed`);

    // Update campaign progress
    await updateCampaignProgress(campaignId, campaign.taskId._id);

    // Schedule next batch
    const timeoutId = setTimeout(() => {
      processCalls(campaignId);
    }, BATCH_DELAY);

    activeCampaigns.set(campaignId, timeoutId);

  } catch (error) {
    console.error('❌ Error processing calls:', error.message);
    const timeoutId = setTimeout(() => {
      processCalls(campaignId);
    }, BATCH_DELAY);
    activeCampaigns.set(campaignId, timeoutId);
  }
};


// Make individual call using Twilio
const makeCall = async (contact, campaign) => {
  const callStartTime = new Date();
  let callRecord = null;

  try {
    console.log(`📞 Calling: ${contact.name} (${contact.phoneNo})`);

    if (!contact.phoneNo) {
      throw new Error('No phone number');
    }

    // Create call record
    callRecord = new Calls({
      call_id: `CALL-${Date.now()}-${contact._id}`,
      customer_id: contact._id,
      call_start_iso: callStartTime,
      call_end_iso: callStartTime,
      call_duration_seconds: 0,
      summary: '',
      sentiment_overall: 'Neutral',
      turn_counts: {
        first_agent_utterance: '',
        last_user_utterance: ''
      },
      transcript: [],
      realtime: {
        created_at_iso: callStartTime,
        updated_at_iso: callStartTime
      }
    });
    await callRecord.save();

    // Prepare TwiML
    const wsUrl = process.env.MEDIA_WS_URL;
    const purpose = campaign.description || campaign.campaignName;

    const twiml = `
      <Response>
        <Connect>
          <Stream url="${wsUrl}">
            <Parameter name="customerId" value="${contact._id}" />
            <Parameter name="purpose" value="${purpose}" />
            <Parameter name="campaignId" value="${campaign.campaignId}" />
          </Stream>
        </Connect>
      </Response>
    `;

    // Make Twilio call
    const callPayload = {
      to: contact.phoneNo,
      from: process.env.TWILIO_NUMBER || process.env.TWILIO_PHONE_NUMBER,
      twiml: twiml,
    };
    if (process.env.BASE_URL && process.env.BASE_URL.startsWith("https://")) {
      callPayload.statusCallback = `${process.env.BASE_URL}/api/calls/status-callback`;
      callPayload.statusCallbackEvent = ['completed'];
      callPayload.statusCallbackMethod = 'POST';
    }
    const twilioCall = await client.calls.create(callPayload);

    console.log(`✓ Call initiated! SID: ${twilioCall.sid}`);

    callRecord.call_id = twilioCall.sid;
    callRecord.summary = `Call initiated to ${contact.name}`;
    await callRecord.save();

    return {
      success: true,
      contact: contact._id,
      callSid: twilioCall.sid
    };

  } catch (error) {
    console.error(`✗ Call failed for ${contact.name}:`, error.message);

    const callEndTime = new Date();
    const durationSeconds = Math.floor((callEndTime - callStartTime) / 1000);

    if (callRecord) {
      callRecord.call_end_iso = callEndTime;
      callRecord.call_duration_seconds = durationSeconds;
      callRecord.summary = `Call failed: ${error.message}`;
      callRecord.realtime.updated_at_iso = callEndTime;
      await callRecord.save();
    }

    return { success: false, contact: contact._id, error: error.message };
  }
};

// Update campaign progress - FIX: Correct progress calculation
// Update campaign progress - FIX: Handle null customer_id
const updateCampaignProgress = async (campaignId, taskId) => {
  try {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) return;

    const totalContacts = await UploadDetails.countDocuments({ taskId });

    if (totalContacts === 0) {
      console.log('⚠️ No contacts found for this task');
      return;
    }

    // Get all contact IDs for this task
    const allContactIds = await UploadDetails.find({ taskId }).select('_id').lean();

    // FIX: Filter out null customer_id values
    const completedCalls = await Calls.countDocuments({
      customer_id: {
        $in: allContactIds.map(c => c._id),
        $exists: true,
        $ne: null
      }
    });

    console.log(`Total: ${totalContacts}, Completed: ${completedCalls}`);

    const inProgressCount = Math.min(CONCURRENT_CALLS, totalContacts - completedCalls);
    const queueCount = Math.max(0, totalContacts - completedCalls - inProgressCount);

    // FIX: Filter null customer_id values
    const allCallsForTask = await Calls.find({
      customer_id: {
        $in: allContactIds.map(c => c._id),
        $exists: true,
        $ne: null
      }
    });

    const answeredCalls = allCallsForTask.filter(
      call => call.call_duration_seconds > 10
    ).length;
    const notAnsweredCalls = completedCalls - answeredCalls;
    const failedCount = allCallsForTask.filter(
      call => call.call_duration_seconds < 5
    ).length;

    const positiveCalls = allCallsForTask.filter(
      call => call.sentiment_overall === 'Positive'
    ).length;
    const neutralCalls = allCallsForTask.filter(
      call => call.sentiment_overall === 'Neutral'
    ).length;
    const negativeCalls = allCallsForTask.filter(
      call => call.sentiment_overall === 'Negative'
    ).length;

    campaign.stats = {
      completed: completedCalls,
      inProgress: inProgressCount,
      queue: queueCount,
      answered: answeredCalls,
      notAnswered: notAnsweredCalls,
      failed: failedCount,
      positive: positiveCalls,
      neutral: neutralCalls,
      negative: negativeCalls
    };

    // FIX: Correct progress calculation
    campaign.progress = Math.round((completedCalls / totalContacts) * 100);

    // Ensure progress doesn't exceed 100
    if (campaign.progress > 100) {
      campaign.progress = 100;
    }

    await campaign.save();

    console.log(`Campaign ${campaignId} progress: ${campaign.progress}%`);

  } catch (error) {
    console.error('Error updating campaign progress:', error.message);
  }
};


// Complete campaign
const completeCampaign = async (campaignId) => {
  try {
    stopAutoCaller(campaignId);

    const campaign = await Campaign.findOne({ campaignId }).populate('taskId');
    if (!campaign) return;

    campaign.status = 'completed';
    campaign.completedAt = new Date();
    campaign.progress = 100;

    const totalContacts = await UploadDetails.countDocuments({
      taskId: campaign.taskId._id
    });

    const allContactIds = await UploadDetails.find({
      taskId: campaign.taskId._id
    }).select('_id');

    const completedCalls = await Calls.countDocuments({
      customer_id: { $in: allContactIds.map(c => c._id) }
    });

    // FIX: Calculate completion rate and cap at 100
    let completionRate = totalContacts > 0
      ? Math.round((completedCalls / totalContacts) * 100)
      : 0;

    // Ensure it doesn't exceed 100
    completionRate = Math.min(completionRate, 100);
    campaign.completionRate = completionRate;

    await campaign.save();

    console.log(`Campaign completed: ${campaignId} (${campaign.completionRate}% completion rate)`);
    return { success: true, message: 'Campaign completed', campaignId };
  } catch (error) {
    console.error('Error completing campaign:', error.message);
    throw error;
  }
};


// Get campaign status
export const getCampaignStatus = async (campaignId) => {
  try {
    const campaign = await Campaign.findOne({ campaignId })
      .populate('taskId');

    const isRunning = activeCampaigns.has(campaignId);

    return {
      success: true,
      isRunning,
      campaign
    };
  } catch (error) {
    console.error('Error getting campaign status:', error);
    throw error;
  }
};

export const getActiveCalls = (campaignId) => {
  return activeCampaigns.has(campaignId);
};
