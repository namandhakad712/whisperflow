# Wispr Flow — Overlay + Status-Window System (RE)

## 1. Window inventory (exact `BrowserWindow` flags)
`tD`=mac, `H8`=win.

**Status / Flow Bar** ("Flow Status Indicator"): `{show:false, preload:../renderer/status/preload.js, backgroundThrottling:false, transparent:true, backgroundColor:"#00000000", hasShadow:false, roundedCorners:false, type: tD?"panel":"toolbar", fullscreen:false, fullscreenable:false, maximizable:false, minimizable:false, resizable:false, movable:false, closable:false, skipTaskbar:true, focusable: allowBubbleFocus (CLI arg), frame:false, alwaysOnTop:true, mac:{hiddenInMissionControl:true, titleBarStyle:"hidden"}}`. After creation: `setAlwaysOnTop(true,"screen-saver")`; **Windows**: native click-shape manager (module 76127) replaces `setIgnoreMouseEvents`; **mac**: `setIgnoreMouseEvents(true,{forward:true})`, `setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})`; macOS 27 + flag `Macos27PanelNonactivation` → native non-activation. Shown via `showInactive()`.

**Context menu**: same flags except `focusable:false`, sized to the whole display work area; `setIgnoreMouseEvents(true)` until shown; shown `setOpacity(0)→showInactive()→setOpacity(1)`; on Windows hides deferred 150 ms (`Promise.race([DidHideFlushed, 150ms])`).

**Overlay** = **extension-panel host**, created only by `createPanelWindow` (extension system, key `mo(extensionId,panelId)`): same flags but `focusable:true`; anchor `"full-screen"` → work-area rect, `alwaysOnTop "floating"`; `"floating"` → `x: workArea.x+w−panelW−14, y: workArea.y+h−panelH−14`; mounts extension iframes (`overlay:mountExtensionPanel` / `overlay:reloadExtensionPanel` / `extensionIframe:message`). **It is NOT the dictation panel — the dictation bubble is the status window.**

**Blackout/dim** is *not a separate window*: it is a state of the status window. `status:setBlackoutOverlay {isActive,source}` → the status window's content bounds expand to the **full display bounds**, renderer paints `[data-attr="blackout-overlay"]` (click-to-dismiss, 50 ms later clears). Sources: `PostOnboarding`, `Polish`, `FlowBarMoveHint`.

## 2. State machine
Enum `fw`: `HIDDEN="hidden", RESTING="resting", CONTEXT_MENU="context-menu", INITIALIZING="initializing", READY="ready", ACTIVE_PTT="active_ptt", ACTIVE_POPO="active_popo", PROCESSING="processing", POLISH_PROCESSING="polish_processing", POLISH_COMPLETED_ACTION, POLISH_COMPLETED_NA, POLISH_FAILED, AUTO_CLEANUP_COMPLETED, HOTKEY_REMINDER="hotkey_reminder", INSTRUCT_COMPLETED, ERROR="error"`.

Two drivers: (a) shared Zustand store synced via **Zubridge** (`zubridge:state-update`, `zubridge:dispatch`, `zubridge:get-state`, `zubridge:register-thunk`); `status:windowReady` returns dictation status. Dictation status enum: `initializing, listening, stopping, processing, dismissed, retrying, error, idle, testing`. (b) Renderer reducer: `listening→ACTIVE_PTT` (unless already ACTIVE_POPO), `processing→PROCESSING`, `initializing→INITIALIZING`, `idle→restState (RESTING|HIDDEN)`, `instructActive→INSTRUCT_COMPLETED` (morphPending if mid-state). Main pushes `status:setIndicatorState` only for polish/auto-cleanup. State→animation CSS-module variant map (e.g. `RESTING→resting`, `ACTIVE_POPO→activePopo`, `HOTKEY_REMINDER→growthNudgeActive`, `HIDDEN→fadeOut`).

**Timer constants (ms)**: `400` monitorMove interval; `150` content-bounds pulse (`setContentBounds(h+1)` compositor nudge) & Windows context-menu hide; `600` dock-transition rate limit; `2000` typing-reminder 2 000-word milestone + dock-transition opacity-0 hold; `6000` post-onboarding blackout auto-off + FlowBarMoveHint→"returning" ghost; `3000` compositor-probe interval; `60000` probe re-schedule; **recovery ladder** when the surface is unresponsive: attempt 1 `webContents.invalidate()`+pulse, 2 hide+show, 3 full window rebuild, then back-off `min(6e5*2^(n-1), 36e5)` (**10 min → … → 60 min cap**); recovery deferred (3 s loop) while dictation status ∈ {initializing, listening, stopping, processing, retrying}; `15000` post-wake refresh second shot; `2000` display-metrics debounce; `200` meeting-flush reveal & context-menu outside-hide; snooze = `60*hours*60*1e3`. `Xi(e)=e>=400` = wide-layout width threshold.

## 3. Drag / dock / follow
Bar is **docked to a screen edge**, not cursor-following. Content bounds (defaults 320/440/490): bottom dock → **440×320 region centered at bottom of work area**; left/right → **490-wide vertical strip, ≤440 tall, centered vertically**; expanded by dock insets, minus `DR=2` when focusable. Edge pref `statusDockEdge` (default `"bottom"`). `clickableBubbleSnoozeUntil`, `hideFlowBarPermanently`, `reminderVisible && !meetingHoldsBar` force edge `"bottom"`.
**Drag**: mousedown → 5 px move = intent (feature flag `CanDragFlowBar="can-drag-flow-bar"`, default disabled; drag also allowed if edge≠bottom). Drag start: registers **Escape global shortcut** to cancel, expands window to full display bounds, sends `status:setDragOverlay {isActive,insets,cursorClient}`; window follows cursor every 400 ms; renderer shows `dragGhost` + nearest-edge indicator; drop updates `statusDockEdge`. During dock-info transitions the bar goes `setOpacity(0)` for up to 2 s. **Click-through**: renderer measures elements with `data-attr` rects and sends `status:reportAlphaCatchRects {rects,shapeRects,viewport}` (**≤512 rects**); Windows native module applies the window shape; mac uses `setIgnoreMouseEvents({forward:true})`; `notification:enableMouseEvents` toggles interactivity; suspended during feature tour.

## 4. IPC channels (literal names)
status: `audioLevel, currentWPM, popo, micActive, monitorChanged, dictationStatus, appInfoUpdated, commandModeStatus, instructModeStatus, playPasteSound, nudgeUsers, activationNudge, welcomeBackNudge, setIndicatorState, setBlackoutOverlay, setDragOverlay, dockPosition, micSilence, openFetchPicker, openShortcutJoinDrawer, armPopoToMeetingMorph, clearPopoToMeetingMorph, copyLastTextTriggered, setReminders, startFlowBarMoveHint`; renderer→main: `windowReady, startClicked, stopClicked, cancelClicked, barHidden, barVisible, snoozeClickableBubble, snoozeContextualNudge, triggerPolish, viewPolishDiff, polishFeedback, requestExtensionIndicator, extensionIndicatorChanged, registerExtensionStatusBubble, unregisterExtensionStatusBubbles, extensionStatusBubbleClicked, reportAlphaCatchRects`.
contextMenu: `windowReady, showContextMenu, hideContextMenu, contextMenuHidden, showDiff, showAutoPolishPicker, hideAutoPolishPicker, showFetchLinkPicker, hideFetchLinkPicker, showShortcutJoinDrawer, hideShortcutJoinDrawer, pinShortcutJoinDrawer, reportShortcutJoinDrawerRect, showInstructChat, showExtensionContextMenu, hideExtensionContextMenu, didShow, didHide, didHideFlushed`.
overlay: `overlay:mountExtensionPanel, overlay:reloadExtensionPanel, extensionIframe:message, extensionStore:response`. postOnboarding: `SetFullscreen, ShowAppSwitchedTooltip, StartWelcomeBackNudge`. notification: `show, enableMouseEvents, clear, hover, callback, isEligible, showedNotification`.

## 5. Animation stack
framer-motion (`motion.div`, `initial/animate/exit/transition`) — vendored in `renderer/vendor/index.js` (React 18, howler, DOMPurify also vendored). Springs: `{type:"spring",stiffness:600,damping:35,restDelta:.05}` (pill); `{duration:.26,type:"spring",stiffness:300,damping:28}` + opacity `.22 easeOut` (notifications). CSS modules with `@keyframes`, `--spring-easing`, `prefers-reduced-motion` guards. **No lottie/gsap.**

## 6. Key excerpts
- Status window: `focusable:d.ty.allowBubbleFocus,frame:!1,alwaysOnTop:!0,...M.tD&&{hiddenInMissionControl:!0,titleBarStyle:"hidden"} … M.H8?Q.replaceWindow(r):r.setIgnoreMouseEvents(!0,{forward:!0})`
- Blackout: `Qe=(e,t)=>{o().info("[Blackout Overlay]: Setting blackout overlay state to ${e} (source: ${t})"),K=e,Ue()}`
- Recovery back-off: `Math.min(6e5*2**Math.max(0,n-1),36e5)` with log "[StatusSurface] Compositor surface still unresponsive after all recovery attempts"

## 7. Cannot determine
- `ACTIVE_POPO` panel position (only the CSS variant visible; no separate pop-out window found).
- Exact semantics of `status:popo`, `armPopoToMeetingMorph`, `PlayPasteSound`, `nudgeUsers` payloads.
- Attribution of module-54103 constants `V=3e3, $=6e6, K=8e3, Y=1e4, Z=6e4…`.
- A/B variant payloads (`TIYOnboardingToasts` Test variant, `NotetakerTutorialIntro` variants) — config JSON not in bundle.
- **No code path repositions the bar to the cursor** — all positioning is dock-edge/drag/blackout based.
