import { useState } from "react";
import { avatarFromName } from "../content/hinglish";
import clsx from "clsx";

type Props = {
  name: string;
  imageUrl?: string | null;
  className?: string;
  showPresence?: boolean;
  isOnline?: boolean;
};

export function MemberAvatar({ name, imageUrl, className = "h-8 w-8", showPresence, isOnline }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const remote = imageUrl || avatarFromName(name, null);
  const initials = name.trim().slice(0, 1).toUpperCase() || "?";
  const showImg = remote && !imgErr;

  return (
    <span className="relative inline-flex shrink-0">
      {showImg ? (
        <img
          src={remote}
          alt=""
          className={clsx("rounded-full object-cover", className)}
          onError={() => setImgErr(true)}
        />
      ) : (
        <span
          className={clsx(
            "flex items-center justify-center rounded-full bg-gradient-to-br from-teal-700 to-teal-900 text-xs font-semibold text-teal-50",
            className,
          )}
        >
          {initials}
        </span>
      )}
      {showPresence && (
        <span
          className={clsx(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#111214]",
            isOnline ? "bg-emerald-500" : "bg-slate-600",
          )}
        />
      )}
    </span>
  );
}
