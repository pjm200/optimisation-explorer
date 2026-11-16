/* Glossary: every hoverable term in the app. key -> {t: title, d: definition (HTML), g: group} */
(function () {
const T = (k, g, t, d) => { OV.terms[k] = { t, d, g }; };

/* --- foundations --- */
T('opt', 'Foundations', 'Optimisation', 'Choosing the <em>best</em> option from a set of allowed options. "Best" is measured by an objective function; "allowed" is defined by constraints.');
T('var', 'Foundations', 'Decision variable', 'A quantity the optimiser is free to choose, e.g. the MW output of a generator. A solution is one value for every variable. Usually written <i>x</i>.');
T('obj', 'Foundations', 'Objective function', 'The single number we want to make as large (maximise) or as small (minimise) as possible, e.g. total cost. In an LP it is a weighted sum of the variables: <i>cᵀx</i>.');
T('coef', 'Foundations', 'Objective coefficient', 'How much one unit of a variable adds to the objective, e.g. £/MWh of a generator. The vector <i>c</i> sets the direction of "better" in the landscape.');
T('con', 'Foundations', 'Constraint', 'A rule every acceptable solution must obey, e.g. "supply must equal demand" or "output ≤ capacity". In an LP each constraint is a straight line (a half-plane) in the landscape.');
T('acoef', 'Foundations', 'Constraint coefficient', 'How much of a limited resource one unit of a variable uses. The matrix <i>A</i> holds one row per constraint and one column per variable.');
T('rhs', 'Foundations', 'Right-hand side (RHS)', 'The limit in a constraint, e.g. the amount of fuel available or the demand to be met. The vector <i>b</i>. Moving it slides the constraint line without rotating it.');
T('nonneg', 'Foundations', 'Non-negativity', 'Most physical quantities cannot be negative, so we require <i>x ≥ 0</i>. These bounds are constraints too: they form the axes of the feasible region.');
T('feas', 'Foundations', 'Feasible', 'A solution is feasible when it satisfies <em>every</em> constraint at once. It need not be good, only allowed.');
T('region', 'Foundations', 'Feasible region', 'The set of all feasible solutions. For an LP it is a convex polygon (a polytope in higher dimensions) with flat sides.');
T('vertex', 'Foundations', 'Vertex (corner point)', 'A corner of the feasible region, where constraints cross. If an LP has an optimum, at least one vertex is optimal, so only corners need to be checked.');
T('lp', 'Foundations', 'Linear programme (LP)', 'An optimisation problem whose objective and constraints are all linear (no squares, products or on/off decisions). LPs with millions of variables are solved routinely.');
T('min', 'Foundations', 'Minimisation', 'Seeking the smallest objective value, e.g. least cost. Any minimisation is a maximisation in disguise: min <i>f</i> = −max(−<i>f</i>).');
T('max', 'Foundations', 'Maximisation', 'Seeking the largest objective value, e.g. most profit. Flip the sign of the objective and it becomes a minimisation.');
T('iso', 'Foundations', 'Iso-objective line (contour)', 'A line along which the objective has the same value. For an LP these are parallel straight lines, perpendicular to the direction <i>c</i>.');
T('slack', 'Foundations', 'Slack', 'The unused part of a ≤ constraint: <i>s = b − aᵀx</i>. Slack 0 means the constraint is binding. Adding slack variables turns inequalities into equations.');
T('binding', 'Foundations', 'Binding (active) constraint', 'A constraint that holds with equality at the solution. It is the one "holding you back": relax it and the optimum improves.');
T('convex', 'Foundations', 'Convex', 'A set is convex if the straight line between any two of its points stays inside it; a convex function is bowl shaped. In convex problems every local optimum is global, which is why they are tractable.');
T('infeasible', 'Foundations', 'Infeasible', 'No point satisfies all the constraints: the feasible region is empty. Usually a sign of contradictory requirements in the model.');
T('unbounded', 'Foundations', 'Unbounded', 'The objective can be improved forever without leaving the feasible region. Usually a sign that a constraint was forgotten.');
T('degenerate', 'Foundations', 'Degeneracy', 'More constraints than necessary pass through one vertex. Simplex may then pivot without moving (a "stall"), and shadow prices stop being unique.');

/* --- duality --- */
T('primal', 'Duality', 'Primal problem', 'The original problem as you wrote it: choose quantities <i>x</i> to optimise the objective subject to resource limits.');
T('dual', 'Duality', 'Dual problem', 'A second LP built from the same data, with one variable per primal constraint. If the primal asks "how much should I make?", the dual asks "what is each resource worth?". Its optimum equals the primal optimum.');
T('dualvar', 'Duality', 'Dual variable (shadow price)', 'The price <i>y</i> attached to a constraint. It tells you how much the optimal objective would improve if that constraint were relaxed by one unit.');
T('shadow', 'Duality', 'Shadow price', 'The change in the optimal objective per unit increase of a constraint\'s right-hand side. Zero for constraints with slack. In power markets the shadow price of the supply = demand constraint is the electricity price.');
T('weak', 'Duality', 'Weak duality', 'Any feasible dual solution gives a bound on any feasible primal solution: for a max problem <i>cᵀx ≤ bᵀy</i>. The dual objective is a ceiling the primal can never break through.');
T('strong', 'Duality', 'Strong duality', 'At the optimum the bound is tight: <i>cᵀx* = bᵀy*</i>. For LPs this always holds (if a finite optimum exists), so the duality gap closes to zero.');
T('gap', 'Duality', 'Duality gap', 'The difference between a dual bound and a primal value. It measures, without knowing the true optimum, how far from optimal you could possibly be. Zero gap is a certificate of optimality.');
T('cs', 'Duality', 'Complementary slackness', 'At the optimum, for every constraint either its slack is zero or its price is zero: <i>yᵢ · sᵢ = 0</i>. A resource you have left over is worth nothing extra.');
T('reduced', 'Duality', 'Reduced cost', 'How much the objective would change per unit if a currently-zero variable were forced into the solution. It is the slack of the matching dual constraint.');
T('cert', 'Duality', 'Certificate of optimality', 'A dual solution with the same objective value as your primal solution. Anyone can check both are feasible and equal, proving optimality without re-solving.');
T('kkt', 'Duality', 'KKT conditions', 'Karush–Kuhn–Tucker: primal feasibility + dual feasibility + complementary slackness. Together they characterise the optimum; every LP algorithm is a way of satisfying them.');

/* --- simplex --- */
T('simplex', 'Simplex', 'Simplex algorithm', 'Dantzig\'s 1947 method: start at a vertex, move along an edge to a better neighbouring vertex, repeat until no neighbour is better. Still the workhorse for LPs and for re-solving inside branch and bound.');
T('basis', 'Simplex', 'Basis', 'The set of variables allowed to be non-zero at a vertex (one per constraint). Choosing a basis is the algebraic way of choosing a corner.');
T('basic', 'Simplex', 'Basic variable', 'A variable in the current basis. Its value is read from the right-hand side of the tableau.');
T('nonbasic', 'Simplex', 'Non-basic variable', 'A variable held at zero at the current vertex. If it is a slack, its constraint is binding.');
T('tableau', 'Simplex', 'Simplex tableau', 'A table holding the constraints rewritten in terms of the current basis. Each pivot rewrites the table for the neighbouring vertex.');
T('pivot', 'Simplex', 'Pivot', 'One simplex step: one variable enters the basis, one leaves. Geometrically, a slide along one edge to the next vertex.');
T('entering', 'Simplex', 'Entering variable', 'The non-basic variable chosen to increase from zero. Any variable with an improving reduced cost will do; Dantzig\'s rule picks the steepest.');
T('leaving', 'Simplex', 'Leaving variable', 'The basic variable that hits zero first as the entering variable grows. Found by the ratio test.');
T('ratio', 'Simplex', 'Ratio test', 'For each row, RHS ÷ entering-column entry tells how far we can move before that basic variable hits zero. The smallest ratio wins: it is the first constraint we bump into.');
T('phase1', 'Simplex', 'Phase I', 'A preliminary LP that finds a first feasible vertex when the origin is not feasible. Phase II then optimises from there.');

/* --- interior point --- */
T('ipm', 'Interior point', 'Interior-point method', 'Instead of walking the boundary, cut through the middle of the feasible region following the central path. Polynomial time, and usually fastest on very large LPs.');
T('barrier', 'Interior point', 'Barrier function', 'A penalty, −μ·Σ log(slack), that grows without limit near the boundary. It turns a constrained problem into a smooth unconstrained one and keeps iterates strictly inside.');
T('mu', 'Interior point', 'Barrier parameter μ', 'How strongly the barrier repels from the walls. Large μ: stay near the centre. μ → 0: the barrier vanishes and we reach the true optimum. For an LP the duality gap on the central path equals (number of constraints) × μ.');
T('central', 'Interior point', 'Central path', 'The curve traced by the barrier problem\'s optimum as μ shrinks from ∞ to 0. It runs from the analytic centre of the region to the optimal vertex.');
T('acentre', 'Interior point', 'Analytic centre', 'The point that maximises the product of all slacks: the place "furthest from every wall". The central path starts here.');
T('newton', 'Interior point', 'Newton step', 'A step computed from the gradient and curvature (Hessian) of the function, jumping to the optimum of its local quadratic model. Each interior-point iteration is one Newton step, costing one linear-system solve.');
T('crossover', 'Interior point', 'Crossover', 'A clean-up phase that turns an interior-point solution (which sits just inside the region) into an exact vertex with a basis, useful for warm starts and sensitivity analysis.');

/* --- integer --- */
T('integer', 'Integer programming', 'Integer variable', 'A variable restricted to whole numbers: units, on/off decisions (0 or 1), numbers of turbines. This one requirement breaks convexity and makes problems fundamentally harder.');
T('milp', 'Integer programming', 'Mixed-integer linear programme (MILP)', 'An LP in which some variables must be integers. Used for unit commitment, investment planning, scheduling and routing.');
T('relax', 'Integer programming', 'LP relaxation', 'The MILP with the integrality requirement dropped. It is easy to solve, and its optimum is a bound: the integer answer can never be better.');
T('bnb', 'Integer programming', 'Branch and bound', 'Solve the relaxation; if a variable is fractional, split the problem in two (x ≤ ⌊v⌋ or x ≥ ⌈v⌉) and recurse. Use bounds to discard whole sub-trees without exploring them.');
T('branch', 'Integer programming', 'Branching', 'Splitting a problem into two sub-problems that together still contain every integer solution but exclude the current fractional one.');
T('bound', 'Integer programming', 'Bound', 'A guaranteed limit on what a sub-problem can achieve, obtained from its LP relaxation. The best bound over all open nodes limits the whole problem.');
T('incumbent', 'Integer programming', 'Incumbent', 'The best integer-feasible solution found so far. Any node whose bound is no better than the incumbent can be discarded.');
T('prune', 'Integer programming', 'Pruning (fathoming)', 'Discarding a node because it is infeasible, already integer, or its bound cannot beat the incumbent. Pruning is what keeps the tree from exploding.');
T('mipgap', 'Integer programming', 'MIP gap', 'The relative difference between the incumbent and the best bound. It is the duality gap of integer programming: solvers stop when it falls below a tolerance such as 0.01%.');
T('cut', 'Integer programming', 'Cutting plane (cut)', 'An extra linear constraint that slices off the fractional LP optimum without removing any integer solution. Cuts tighten the relaxation and so improve the bound.');
T('hull', 'Integer programming', 'Integer hull', 'The smallest convex polygon containing every integer-feasible point. If we knew it exactly, a plain LP would solve the integer problem. Cuts approximate it where it matters.');
T('bnc', 'Integer programming', 'Branch and cut', 'Branch and bound with cutting planes added at the nodes. Tighter relaxations mean better bounds, more pruning and far smaller trees. This is what every modern MILP solver does.');
T('gomory', 'Integer programming', 'Gomory cut', 'A cut derived mechanically from a row of the simplex tableau with a fractional right-hand side. Along with MIR, cover and clique cuts, one of the standard families solvers generate automatically.');
T('nphard', 'Integer programming', 'NP-hard', 'A class of problems for which no algorithm is known that is fast in the worst case. Integer programming is NP-hard, which is why clever bounding matters so much.');

/* --- heuristics --- */
T('heuristic', 'Heuristics', 'Heuristic / metaheuristic', 'A search strategy that finds good solutions quickly but offers no proof of optimality and no bound. Useful when the landscape is non-convex, noisy or a black box.');
T('local', 'Heuristics', 'Local optimum', 'A point better than all its neighbours, but not necessarily the best overall. Non-convex landscapes can have many; downhill-only methods get trapped in them.');
T('global', 'Heuristics', 'Global optimum', 'The best solution over the entire search space.');
T('sa', 'Heuristics', 'Simulated annealing', 'A random search that always accepts improvements and sometimes accepts worse moves, with a probability that falls as a "temperature" cools. Early on it explores; later it settles.');
T('temp', 'Heuristics', 'Temperature', 'The control knob of simulated annealing. High temperature: almost any move is accepted (exploration). Low temperature: only improvements are accepted (exploitation).');
T('boltz', 'Heuristics', 'Metropolis acceptance rule', 'Accept a move that worsens the objective by Δ with probability e<sup>−Δ/T</sup>. Small set-backs at high temperature are likely; large ones at low temperature are almost impossible.');
T('cooling', 'Heuristics', 'Cooling schedule', 'How the temperature is lowered over time, e.g. multiplied by 0.99 each step. Cool too fast and you freeze into a poor local optimum; too slowly and you waste time.');
T('gradient', 'Heuristics', 'Gradient', 'The vector of slopes of the objective: it points in the direction of steepest increase. Step against it to go downhill.');
T('gd', 'Heuristics', 'Gradient descent', 'Repeatedly step in the direction of steepest descent. Fast and scalable, but only guaranteed to find a local optimum. The engine behind machine-learning training.');
T('lr', 'Heuristics', 'Step size (learning rate)', 'How far to move along the downhill direction each iteration. Too small is slow; too large overshoots and may diverge.');
T('momentum', 'Heuristics', 'Momentum', 'Keep a fraction of the previous step, like a ball with inertia. Smooths zig-zags and can carry the search through shallow dips.');
T('pso', 'Heuristics', 'Particle swarm optimisation', 'A population of points "flies" over the landscape. Each is pulled toward its own best find and the swarm\'s best find, sharing information as they go.');
T('inertia', 'Heuristics', 'Inertia weight', 'The fraction of a particle\'s velocity that carries over to the next step. High inertia explores widely; low inertia converges quickly.');
T('explore', 'Heuristics', 'Exploration vs exploitation', 'The central trade-off of heuristic search: look in new places (explore) or refine the best place found so far (exploit).');

/* --- energy --- */
T('dispatch', 'Energy', 'Economic dispatch', 'Deciding how much each available generator should produce to meet demand at least cost. A textbook LP, solved every few minutes by system operators.');
T('merit', 'Energy', 'Merit order', 'Generators ranked from cheapest to most expensive marginal cost. Meeting demand at least cost means filling the stack from the cheap end, which is exactly what the LP optimum does.');
T('mc', 'Energy', 'Marginal cost', 'The cost of producing one more MWh from a plant: mainly fuel plus carbon. Wind and solar are close to zero.');
T('smp', 'Energy', 'System marginal price', 'The cost of supplying one more MWh of demand. Mathematically, it is the dual variable (shadow price) of the supply = demand constraint. It is set by the marginal generator.');
T('marginal', 'Energy', 'Marginal generator', 'The plant that would supply the next MWh of demand: part-loaded, neither off nor at full output. Its marginal cost sets the price.');
T('rent', 'Energy', 'Inframarginal rent', 'Price minus marginal cost for a plant running below the price. It is the dual variable of that plant\'s capacity constraint: the value of one more MW of that capacity.');
T('balance', 'Energy', 'Power balance', 'Supply must equal demand at every instant. The constraint whose dual variable is the electricity price.');
T('soc', 'Energy', 'State of charge', 'The energy currently held in the store (MWh). It links each hour to the next, which is what turns 24 small problems into one big one.');
T('eff', 'Energy', 'Round-trip efficiency', 'The fraction of energy put into a store that comes back out. A battery at 88% must sell at a price at least 1/0.88 times the price it bought at to break even.');
T('arbitrage', 'Energy', 'Arbitrage', 'Buying (charging) when prices are low and selling (discharging) when they are high. In a least-cost LP it emerges automatically: nobody tells the battery when to charge.');
T('curtail', 'Energy', 'Curtailment', 'Deliberately wasting available wind or solar because there is nowhere for the energy to go. Appears in the LP as a slack variable on renewable output.');
T('voll', 'Energy', 'Value of lost load', 'A very high penalty price (thousands of £/MWh) for failing to serve demand. Including it keeps the model feasible and makes shortage visible as a price spike.');
T('uc', 'Energy', 'Unit commitment', 'Deciding which generators to switch on and off over time, as well as how much they produce. The on/off decisions are binary variables, making this a MILP.');
T('pmin', 'Energy', 'Minimum stable generation', 'The lowest output at which a thermal unit can run. A unit is either off (0) or between P<sub>min</sub> and P<sub>max</sub>: a gap that only a binary variable can model.');
T('startup', 'Energy', 'Start-up cost', 'A one-off cost each time a unit is switched on (fuel to warm up, wear). It makes it worth keeping units running through short dips in demand.');
T('noload', 'Energy', 'No-load cost', 'A fixed cost per hour of simply being on, regardless of output.');
T('binary', 'Energy', 'Binary variable', 'An integer variable that can only be 0 or 1: off or on, build or do not build.');
})();
