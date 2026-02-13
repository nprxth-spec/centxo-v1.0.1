"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background p-3",
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between pointer-events-none", // Ensure pointer-events-none on container
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 p-0 opacity-50 hover:opacity-100 pointer-events-auto z-10", // Enable pointer events for buttons
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 p-0 opacity-50 hover:opacity-100 pointer-events-auto z-10", // Enable pointer events for buttons
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-9 w-full",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-9 gap-1.5",
          defaultClassNames.dropdowns
        ),
        caption_label: cn(
          "select-none font-medium text-sm",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex w-full", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 flex items-center justify-center", // Added flex-1 and center
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "relative p-0 text-center focus-within:relative focus-within:z-20 text-sm", // Removed w-full h-full from here, handled in button
          defaultClassNames.day
        ),
        range_start: cn(
          "range-start",
          defaultClassNames.range_start
        ),
        range_middle: cn("range-middle", defaultClassNames.range_middle),
        range_end: cn("range-end", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("h-4 w-4", className)} {...props} />
            )
          }
          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("h-4 w-4", className)}
                {...props}
              />
            )
          }
          return (
            <ChevronDownIcon className={cn("h-4 w-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      // data attributes for styling hooks if needed
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "h-9 w-9 p-0 font-normal aria-selected:opacity-100 flex items-center justify-center", // ensure strict size and center
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        "data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-start=true]:rounded-l-md",
        "data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-end=true]:rounded-r-md",
        "data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-middle=true]:rounded-none",
        className
      )}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
