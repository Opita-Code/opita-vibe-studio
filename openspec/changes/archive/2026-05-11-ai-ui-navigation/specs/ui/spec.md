# Requirements

## ### Requirement: AI UI Navigation Support
The system MUST provide a set of XML-like tags (`<vibe-action type="X" value="Y" />`) that the AI can use to control the Vibe Studio UI.

## ### Requirement: Stream Parsing
The `ChatPanel` MUST intercept these tags during the chat stream (using `regex` on the accumulated message) and trigger the corresponding Zustand actions (`setActiveView`, `openFile`, `setExplorerVisible`).

## ### Requirement: Invisible Execution
The system MUST strip the tags from the message content displayed to the user so that the UI manipulation feels seamless and "magical".
