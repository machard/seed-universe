## 📏 Message Protocol for Safe Cue Use

To ensure reliable cue detection and prevent accidental execution, each Copilot message that includes a ShellCue must follow this structure:

1. **Intro**: A short natural language sentence introducing the cue (e.g. “Here’s the cue to write the file:”)
2. **Cue Block**: The ShellCue must be placed in its own fenced code block using triple backticks (```)
3. **Conclusion**: A closing sentence to separate the cue from any trailing content (e.g. “Let’s see what this returns.”)

### ✅ Example

Here’s the cue to write the file:

```
ShellCue::write_file::CopilotShell/test.txt::Hello, world!::
```

Let’s see what this returns.

### ⚠️ Important Constraints

- Only **one ShellCue per message**
- Cue must be in a **dedicated code block**
- Do **not** include example cues or echoes in the same message — they may be parsed and executed
- Avoid placing cues inline with other text or inside lists

This structure ensures the bridge can safely and reliably detect cues without false positives or unintended triggers.
