import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="eq-sonner group"
      toastOptions={{
        classNames: {
          toast:
            "eq-sonner-toast group !rounded-md !border !border-border !bg-background !text-foreground !shadow-lg !text-sm !leading-5",
          content: "eq-sonner-content !grid !gap-1 !text-sm",
          title: "eq-sonner-title !text-sm !font-semibold !leading-5 !text-foreground",
          description: "eq-sonner-description !text-sm !leading-5 !text-muted-foreground",
          actionButton:
            "eq-sonner-action !bg-primary !text-primary-foreground",
          cancelButton:
            "eq-sonner-cancel !bg-muted !text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
