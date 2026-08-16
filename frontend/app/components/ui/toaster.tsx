import { useToast } from "../../hooks/use-toast";
import { Toast } from "./toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:top-4 sm:right-4 sm:flex-col md:max-w-[380px] gap-2 pointer-events-none"
    >
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast
            key={id}
            variant={variant}
            title={title}
            description={description}
            action={action}
            onClose={() => dismiss(id)}
            {...props}
          />
        );
      })}
    </div>
  );
}
