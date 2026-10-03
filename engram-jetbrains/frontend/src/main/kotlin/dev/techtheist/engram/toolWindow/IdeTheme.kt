package dev.techtheist.engram.toolWindow

import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.ui.JBColor
import java.awt.Color
import javax.swing.UIManager

/**
 * The live IDE theme as the pane's "Match IDE" skin reads it (0.9.11): a
 * handful of colors, the corner radii and the UI and editor fonts. JCEF
 * injects nothing into a page, so the panel pushes this payload into the
 * pane on every load and on every theme change.
 *
 * Read only through long-stable public APIs — Swing's UIManager keys (the
 * names every IntelliJ theme JSON defines), JBColor.isBright() and the
 * editor color scheme — so the same code serves the 2026.1 and 2026.2+
 * artifacts. Every key falls back, and the pane falls back again to its own
 * static palette for anything absent.
 */
internal object IdeTheme {
    /** Percent of the control stroke kept against the background. */
    private const val BORDER_MIX = 65

    fun isDark(): Boolean = !JBColor.isBright()

    /** The `window.__engramApplyIdeTheme(payload)` call, as a JS statement. */
    fun script(): String {
        val payload = payloadJson()
        return "window.__engramApplyIdeTheme ? window.__engramApplyIdeTheme($payload) " +
            ": (window.__ENGRAM_IDE_THEME__ = $payload);"
    }

    fun payloadJson(): String {
        val scheme = EditorColorsManager.getInstance().globalScheme
        val bg = color("ToolWindow.background", "Panel.background")
        val colors = linkedMapOf(
            "bg" to bg,
            "elevated" to (color("Popup.background", "PopupMenu.background") ?: bg),
            "canvas" to scheme.defaultBackground,
            "fg" to color("Label.foreground"),
            // Hint text: the info foreground, brighter than the disabled one.
            "fg-muted" to color("Component.infoForeground", "Label.infoForeground", "Label.disabledForeground"),
            // The control stroke (buttons, fields) — Borders.color is the
            // panel separator, close to the background in the New UI.
            "border" to color("Component.borderColor", "Button.startBorderColor", "Borders.color"),
            "accent" to color("Button.default.startBackground", "Component.focusColor"),
            "accent-fg" to color("Button.default.foreground"),
            "hover" to color("ActionButton.hoverBackground", "List.hoverBackground"),
            "focus" to color("Component.focusColor"),
        )
        // Swing arcs are corner DIAMETERS; CSS wants radii.
        val component = arc("Component.arc", 6)
        val button = arc("Button.arc", component)
        val popup = arc("Popup.Border.arc", button + 4)
        val radius = linkedMapOf(
            "sm" to (component / 2).coerceAtLeast(2),
            "md" to (button / 2).coerceAtLeast(3),
            "lg" to (popup / 2).coerceAtLeast(button / 2 + 2),
            "xl" to (popup / 2).coerceAtLeast(button / 2 + 2) + 2,
            // Buttons and toggles: a step rounder than the button arc reads
            // like the New UI's own toolbar controls.
            "control" to button / 2 + 2,
        )
        val font = uiFontStack(UIManager.getFont("Label.font")?.family)
        val mono = "${quote(scheme.editorFontName)}, ui-monospace, monospace"

        val sb = StringBuilder("{")
        sb.append("\"dark\":").append(isDark())
        sb.append(",\"colors\":{")
        sb.append(
            colors.entries
                .filter { it.value != null }
                .joinToString(",") { (k, v) -> "${str(k)}:${str(css(v!!))}" },
        )
        sb.append("},\"radius\":{")
        sb.append(radius.entries.joinToString(",") { (k, v) -> "${str(k)}:$v" })
        // The control stroke, blended toward the background: the IDE draws
        // it lighter around its own buttons than Component.borderColor reads.
        sb.append("},\"borderMix\":").append(BORDER_MIX)
        sb.append(",\"font\":").append(str(font))
        sb.append(",\"mono\":").append(str(mono))
        sb.append("}")
        return sb.toString()
    }

    private fun color(vararg keys: String): Color? = keys.firstNotNullOfOrNull { UIManager.getColor(it) }

    private fun arc(key: String, default: Int): Int =
        UIManager.getInt(key).takeIf { it > 0 } ?: default

    private fun css(c: Color): String =
        if (c.alpha == 255) {
            "#%02x%02x%02x".format(c.red, c.green, c.blue)
        } else {
            "rgb(${c.red} ${c.green} ${c.blue} / ${"%.3f".format(java.util.Locale.ROOT, c.alpha / 255.0)})"
        }

    /**
     * The UI font as a CSS stack. Java's logical and macOS-private names
     * (".AppleSystemUIFont", "Dialog", "SansSerif") mean "the system UI
     * font", which CSS spells `system-ui`.
     */
    private fun uiFontStack(family: String?): String {
        val system = "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
        if (family.isNullOrBlank() || family.startsWith(".") ||
            family in setOf("Dialog", "SansSerif", "Default")
        ) {
            return system
        }
        return "${quote(family)}, $system"
    }

    private fun quote(name: String): String = "\"" + name.replace("\"", "").replace("\\", "") + "\""

    /** A JSON string literal. */
    private fun str(s: String): String {
        val out = StringBuilder("\"")
        for (ch in s) {
            when {
                ch == '"' -> out.append("\\\"")
                ch == '\\' -> out.append("\\\\")
                ch == '<' -> out.append("\\u003c") // never "</script>" in a JS statement
                ch.code < 0x20 -> out.append("\\u%04x".format(ch.code))
                else -> out.append(ch)
            }
        }
        return out.append('"').toString()
    }
}
