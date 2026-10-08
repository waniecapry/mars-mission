# AGENTS.md

## Frontend CSS

Use `docs/css-reference.css` as the reference for CSS written in this project.
Match its conventions when adding or editing styles:

- Write plain CSS with descriptive, kebab-case class names. Use a base class with separate variant or state classes, such as `.button` and `.button-primary`.
- Put opening braces on their own line. Use four-space indentation and one declaration per line. Keep selectors and rules readable rather than compressed.
- Organize the stylesheet into named sections using the large banner comments shown in the reference. Add a `Targets >>` comment when a rule's layout purpose or accessibility behavior needs explanation.
- Use semantic custom properties in `:root` for shared values. Follow the reference's `rgb(...)` color syntax and existing color vocabulary.
- Follow the existing typography, restrained green palette, borders, spacing, and compact control styles. Reuse existing components before inventing new ones.
- Keep responsive rules in clearly named media-query sections near the end. Preserve visible focus, disabled states, and reduced-motion behavior.
- Do not replace this styling approach with Tailwind, CSS-in-JS, or a new component library unless I explicitly request it.
- After implementing a screen, run it and inspect desktop and mobile layouts. Fix visual inconsistencies with the reference before reporting completion.