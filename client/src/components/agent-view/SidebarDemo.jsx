import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  LayoutDashboard,
  MessageSquarePlus,
  MessageCircle,
  ClipboardList,
  Users,
  Target,
  Phone,
  Clock,
  Megaphone,
  Bot,
  LogOut
} from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "@/store/auth-slice";
import { toast } from "sonner";

// Utility function for className merging
const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

// Sidebar Context
const SidebarContext = createContext(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({ children, open, setOpen, animate }) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...props} />
    </>
  );
};

export const DesktopSidebar = ({ className, children, ...props }) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-3 py-4 hidden md:flex md:flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-20 shadow-sm transition-all duration-200",
        className
      )}
      animate={{
        width: animate ? (open ? "240px" : "68px") : "240px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({ className, children, ...props }) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-14 px-4 flex flex-row md:hidden items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-full"
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Whitespace CRM</span>
        </div>
        <div className="flex justify-end z-20">
          <Menu
            className="text-slate-700 dark:text-slate-200 cursor-pointer w-5 h-5"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.25,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white dark:bg-slate-900 p-6 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-6 top-6 z-50 text-slate-700 dark:text-slate-200 cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X className="w-5 h-5" />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({ link, className, ...props }) => {
  const { open, animate } = useSidebar();
  const location = useLocation();
  const isActive =
    location.pathname === link.path ||
    (link.path !== "/agent/dashboard" && location.pathname.startsWith(link.path));

  return (
    <Link
      to={link.path}
      title={!open ? link.label : undefined}
      className={cn(
        "transition-all duration-150 group relative",
        open
          ? "w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
          : "w-10 h-10 mx-auto flex items-center justify-center rounded-xl p-0",
        isActive
          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex-shrink-0 transition-colors flex items-center justify-center",
          isActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
        )}
      >
        {link.icon}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="truncate inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};

// Logo Components
export const Logo = () => {
  return (
    <Link
      to="/agent/dashboard"
      className="flex items-center gap-3 px-1 py-1 relative z-20 group"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
        <Bot className="h-5 w-5" />
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col truncate"
      >
        <span className="font-bold text-slate-900 dark:text-white text-base leading-tight tracking-tight truncate">
          Whitespace CRM
        </span>
        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
          Voice AI Platform
        </span>
      </motion.div>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      to="/agent/dashboard"
      className="w-10 h-10 mx-auto flex items-center justify-center relative z-20"
      title="Whitespace CRM"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
        <Bot className="h-5 w-5" />
      </div>
    </Link>
  );
};

// Main Demo Component
export default function SidebarDemo() {
  const links = [
    {
      label: "Dashboard",
      path: "/agent/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Compose Message",
      path: "/agent/composemessage",
      icon: <MessageSquarePlus className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "WhatsApp Inbox",
      path: "/agent/whatsapp-inbox",
      icon: <MessageCircle className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Task Management",
      path: "/agent/task-management",
      icon: <ClipboardList className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "My Contacts",
      path: "/agent/my-contacts",
      icon: <Users className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Leads",
      path: "/agent/leads",
      icon: <Target className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "AI Call Manager",
      path: "/agent/aicallmanager",
      icon: <Phone className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Pending Followups",
      path: "/agent/pending-followups",
      icon: <Clock className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Campaigns",
      path: "/agent/campaigns",
      icon: <Megaphone className="h-5 w-5 flex-shrink-0" />,
    },
  ];

  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      toast.success("Logged out successfully");
      navigate("/auth/login");
    } catch (error) {
      toast.error(error?.message || "Failed to logout. Please try again.");
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A1";

  return (
    <div className="h-screen w-full bg-slate-50/70 dark:bg-slate-950 flex flex-col md:flex-row overflow-hidden">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-6 flex flex-col gap-1.5">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-col gap-2">
            {open ? (
              <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                  {userInitials}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {user?.name || "Agent Clinical Portal"}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {user?.email || "agent@whitespace.ai"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 mx-auto rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition" title={user?.name || "Agent Clinical Portal"}>
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                  {userInitials}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              title={!open ? "Logout" : undefined}
              className={cn(
                "transition-all duration-150 cursor-pointer",
                open
                  ? "w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  : "w-10 h-10 mx-auto flex items-center justify-center rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {open && <span className="truncate">Logout</span>}
            </button>
          </div>
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
