# A small world. A realistic week.

Sidequest is an editorial planning tool. Warm paper, clear ink, crisp rules and a vivid periwinkle accent. The calendar is the hero; characters occupy their own quiet perches. No novelty fonts or random emoji.

## Tokens and compositions

Manrope headings, DM Sans UI, tabular numerals. Spacing multiples of 8 (4 for optical adjustments). Radii: 8 controls, 12 blocks, 20 feature panels. Border-led surfaces, nearly no shadow. Light: #f8f9f6 canvas, white surface, #202b29 ink, #5356d9 accent. Dark: #171d20 canvas, #20282c surface, #eef3ed ink, #a8aaff accent. Mint = done, coral = recovery, amber = proposals, lavender = reflection. Each has a separate readable foreground token.

Today: asymmetric next-action panel, illustrated perch, chronological rail, slim unplanned column. Week: ruled time canvas and compact planning queue. Habits: spacious editorial rows and detail sheet. Tasks: grouped work list. Progress: one weekly chart and explanatory recap. Settings: left-hand categories and form sections. Onboarding: split composition with a short optional character introduction.

## Original cast

**Pip, the pathfinder.** Quietly curious; a little forward motion is enough. Distinct pointed hood, pear-shaped body, two broad boots, face opening, trailing scarf and small crossbody satchel. Periwinkle, ink, warm cream, tangerine. Today, onboarding, first completion and empty plans.

**Zip, the momentum keeper.** Enthusiastic but knows when to stop. Angular kite silhouette, swept antenna tufts, tiny folded wings, long striped socks and a pennant. Mint, dark teal, butter yellow. Completed work and weekly recap.

**Moss, the recovery companion.** Patient, practical, excellent at sitting. Low mushroom cap, asymmetric brim, chunky stem body, short arms and boots; a leaf-shaped umbrella. Coral, warm cream, muted plum. Recovery, shorter versions, restful empty states.

The common grammar is an ink outline, curved compact limbs, cream face plates, small eyes, deliberate asymmetry, and two-tone planar shading. Rigs have separate root, body, face, pupils, lids, arms, legs, scarf/wing/cap and prop joints. Source lives in src/components/character-art.tsx; editable exported SVGs are in public/characters. Do not flatten the joints.

## Motion contract

UI: 140ms feedback, 220ms transitions, 360ms spatial movement; easing cubic-bezier(.2,.8,.2,1). Spring equivalent: stiffness 280, damping 28, mass .8. Scale feedback 0.98–1.02; no celebratory UI travel. Dialogs move 12px. Blocks snap to 15 minutes and animate the final transform; accessible editing uses the same server path.

Pip: medium weight, 130ms anticipation, 280ms airborne hop, 150ms squash landing, scarf trails 70ms. Zip: light, 90ms anticipation, quick asymmetric wing flourish, 120ms settle. Moss: heavier, 200ms gathering motion, gentle low hop, 240ms settle. Gaze shifts precede body action. Breathing is 4–6s at <2%; blink every 5–8s. No perpetual bouncing.

States: idle, notice, hop, travel, land, celebrate, think, tired, recover, sleep. Each event cancels previous clips and resets joint transforms before the next performance. Travel → hop → land → idle; celebration has anticipation, apex, landing and settle. Recovery opens the arms and tilts the cap/hood; no drooping guilt pose. Animations never gate data changes. A scene pauses when hidden or offscreen, cleans up all animation handles on unmount, and defaults to a readable static pose if Web Animations is unavailable.

Reduced motion replaces movement with a brief eye/face change. Companions can be hidden independently of XP, streaks, achievements and humour. The gallery at /gallery exposes every state, pause and reduced motion. The Today completion group moment can be skipped.

## Pipeline tradeoff

Use hand-authored, articulated SVG plus the browser's Web Animations API as the rig runtime, with Motion for UI choreography. This preserves editable vector joints without a proprietary Rive editor or a WebGL canvas. Assets are under 15KB each, accessible UI is independent of asset loading, and motion is event-driven. This is a real multi-part rig, not a translated bitmap. To extend: keep joint names, add palette and silhouette variants, export assets, exercise every state in the gallery, then review at 100px and 220px.
