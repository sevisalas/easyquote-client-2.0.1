# Memory: features/pdf/adjustment-visibility-rules
Updated: 2026-03-05

Item-level and budget-level adjustments are now shown in ALL templates (including 7 and 8 / Campillo and Anebri) for both Quote PDFs and Sales Order PDFs. They are also exported to Holded as separate line items (discounts as discounts, surcharges as additional lines). The previous behavior of hiding adjustments in Quote PDFs and distributing them proportionally in Holded exports for templates 7/8 has been removed. In multi-quantity PDFs, adjustments are dynamically recalculated for each quantity tier (Q2, Q3) using their specific logic (multiplier, divider) to ensure accurate pricing for all options.
