# Final Meal design canvas generator

Generates every artboard of the Final Meal design canvas
(https://claude.ai/artifact/EJSWeoSKuhgowyi5jeWzPc).

    python3 gen.py

Writes `canvas/project/*.dc.html` and `canvas/project/canvas.json` next to this file,
which Claude then publishes to the canvas. Edit the screen functions in `gen.py`,
re-run, and republish.

`canvas/` is ignored by git. The committed copy of every published board lives in
`design/canvas/project/`; refresh it after each publish so git matches the live canvas.
