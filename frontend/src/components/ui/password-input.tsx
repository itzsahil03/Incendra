import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/** Wraps Input with a show/hide toggle. Pass `iconClassName` to override the toggle
 *  button's color on non-default (e.g. dark hero) backgrounds — see LoginPage/RegisterPage
 *  for the dark-surface override vs ChangePasswordPage's default light styling. */
function PasswordInput({
  className,
  iconClassName,
  ...props
}: React.ComponentProps<"input"> & { iconClassName?: string }) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className={cn(
          "absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground",
          iconClassName
        )}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
