# Mortgage Scenario Comparison Tool

This application is a **Mortgage Scenario Comparison tool**. It allows you to:

1.  **Define different mortgage scenarios:** Input details like home price, down payment (as an amount or percentage), interest rate, and loan term for various potential mortgages.
2.  **Compare amortization:** See the breakdown of principal and interest paid each year for every scenario.
3.  **Analyze long-term wealth:** It uniquely calculates how your net worth might change over time for each scenario. It does this by simulating the investment growth you could achieve by investing the difference in annual costs between the scenarios (assuming you invest savings from lower-cost options).
4.  **Visualize results:** Compare scenarios easily using summary cards, a detailed year-by-year table, and an interactive chart showing the progression of net worth, principal paid, interest paid, loan balance, and investment value over the life of the loans.

Essentially, it helps you make a more informed mortgage decision by looking not just at monthly payments, but at the potential long-term impact on your overall financial picture, including investment opportunity costs.

*(Note: As an interesting experiment, this tool was almost entirely generated using AI assistance!)*

---

## Development Setup (Based on Vite React TS Template)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
	extends: [
		// Remove ...tseslint.configs.recommended and replace with this
		...tseslint.configs.recommendedTypeChecked,
		// Alternatively, use this for stricter rules
		...tseslint.configs.strictTypeChecked,
		// Optionally, add this for stylistic rules
		...tseslint.configs.stylisticTypeChecked,
	],
	languageOptions: {
		// other options...
		parserOptions: {
			project: ['./tsconfig.node.json', './tsconfig.app.json'],
			tsconfigRootDir: import.meta.dirname,
		},
	},
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
	plugins: {
		// Add the react-x and react-dom plugins
		'react-x': reactX,
		'react-dom': reactDom,
	},
	rules: {
		// other rules...
		// Enable its recommended typescript rules
		...reactX.configs['recommended-typescript'].rules,
		...reactDom.configs.recommended.rules,
	},
})
```
