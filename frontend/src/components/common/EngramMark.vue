<template>
<!-- The Engram mark (0.9.7): the icon without its box — three bars cut on a
         diagonal by the face on the right. The bars take `currentColor`
         (the host sets the brand or IDE accent), the face `--mark-face`
         (defaults to the theme's text color, so it reads on any surface);
         the bars' opacity is `--mark-bars-opacity` (0.9 as drawn).
         Content spans 10–110 of a 120 box, so it sits centered as drawn. -->
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill-rule="evenodd">
        <path class="mark-face" d="M110 10L110 110 30 110 100 10 110 10Z" />
        <path class="mark-bar" d="M10 35.1039L10 10 110 10 110 10 90 10 72.4273 35.1039 10 35.1039Z" />
        <path class="mark-bar" d="M63.7139 47.5517L46.1411 72.6557 10 72.6557 10 47.5517 63.7139 47.5517Z" />
        <path class="mark-bar" d="M10 84.8961L10 110 110 110 110 110 90 110 72.4273 84.8961 10 84.8961Z" />
    </g>
</svg>
</template>

<style scoped>
.mark-face {
    fill: var(--mark-face, var(--text-primary));
}

.mark-bar {
    fill: currentcolor;
    fill-opacity: var(--mark-bars-opacity, 0.9);
}
</style>
