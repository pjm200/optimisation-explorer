# Optimisation Explorer

An interactive, visual guide to linear optimisation, duality and the algorithms that solve it, ending with energy system models. Plain HTML, CSS and JavaScript: no build step, no dependencies, no server-side code.

## Pages

| Group | Page | What you can do |
|---|---|---|
| Foundations | Anatomy of a problem | Drag a point around a feasible region; see variables, objective, constraints and coefficients live |
| | Geometry | Reshape an LP by dragging constraints and the objective; infeasible, unbounded and degenerate cases |
| | Duality and the gap | Drag primal and dual points and watch the duality gap close; shadow prices re-solved live |
| Solving LPs exactly | Simplex | Vertex walk with the full tableau, entering/leaving variables and ratio test |
| | Interior point | Barrier method following the central path, with primal/dual convergence |
| Integer decisions | Branch and bound | Search tree, pruning, incumbent vs bound, MIP gap |
| | Branch and cut | Cutting planes slicing off fractional corners, compared with plain branch and bound |
| Heuristics | Simulated annealing, gradient descent, particle swarm | Sculpt a non-convex landscape (2-D map or 3-D surface) and watch each method search it |
| Playground | The Lab | Any landscape, any algorithm, plus a comparison table |
| Energy systems | Dispatch and prices | Merit order as an LP; the dual of the balance constraint is the power price |
| | Load, generation and storage | 24-hour LP with a battery, solved in the browser; prices are the duals |
| | Unit commitment | A MILP solved by branch and bound, showing bound and incumbent converging |
| Reference | Glossary | Every hoverable term, searchable |

Hover any dotted term or any symbol in a formula for a definition.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python -m http.server 8765
```

then visit <http://localhost:8765>.

## Publish on GitHub Pages

1. Create a repository on GitHub and push this folder to it.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Structure

```
index.html            shell: sidebar, page container, script tags
css/style.css         all styling
js/core.js            helpers, maths markup, tooltips, controls, step player, charts, router
js/terms.js           glossary (drives the hover help and the glossary page)
js/lp.js              engines: 2-D LP geometry, simplex + tableau, barrier interior point,
                      branch & bound / cut, and a general two-phase simplex with duals
js/lpview.js          the editable LP landscape canvas
js/terrain.js         the non-convex landscape (2-D / 3-D) and the three heuristics
js/pages-*.js         one file per group of pages
```

To add a page, call `OV.page({ id, group, title, nav, render(root) { ... } })` in one of the `pages-*.js` files; the sidebar and previous/next links are generated from the registration order.

## Notes on the models

- The 2-D solvers are exact for the problems shown. Branch and cut uses facets of the integer hull as cuts, which is only possible because the problems are tiny; real solvers generate Gomory, MIR and cover cuts instead.
- The interior-point page uses a primal log-barrier method. Production solvers use primal-dual predictor-corrector variants, but the central path and the gap = m·μ relationship are the same.
- The energy models use illustrative costs and capacities, not data for any real system.
