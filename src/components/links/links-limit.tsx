import { buttonVariants } from "@/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { cn } from "@/utils";
import { PackageIcon, TriangleAlertIcon } from "lucide-react";

interface LinksLimitProps {
  userLinks: number;
  maxLinks: number;
}

const LinksLimit = ({ userLinks, maxLinks }: LinksLimitProps) => {
  // Treat maxLinks <= 0 or undefined as unlimited
  const isUnlimited = !maxLinks || maxLinks <= 0;
  const max = !isUnlimited && userLinks >= maxLinks;
  const mid = !isUnlimited && userLinks >= maxLinks / 2;

  const maxLabel = isUnlimited ? "∞" : maxLinks < 10 ? `0${maxLinks}` : `${maxLinks}`;

  const tooltipText = isUnlimited
    ? `You have created ${userLinks} links. (Unlimited)`
    : max
    ? `You have reached the maximum limit of ${maxLinks} links.`
    : `You have created ${userLinks} out of ${maxLinks} links.`;

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={buttonVariants({
              variant: "outline",
              className: "cursor-default font-mono shadow-none",
            })}
          >
            <div
              className={cn(
                mid ? "text-yellow-500" : "",
                max ? "text-red-500" : "",
                "flex items-center space-x-2",
              )}
            >
              {max ? (
                <TriangleAlertIcon size={14} />
              ) : (
                <PackageIcon size={14} />
              )}
              <span>
                {userLinks < 10 ? `0${userLinks}` : userLinks}
                {"/"}
                {maxLabel}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LinksLimit;
