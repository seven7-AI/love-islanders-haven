import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "supabase/functions/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Lovable-generated code uses `any` widely; tightened per feature as code moves behind the API.
      "@typescript-eslint/no-explicit-any": "warn",
      // Data goes through the Love Islander API (src/lib/api); supabase-js is only for auth and signed uploads.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='supabase'][property.name=/^(from|rpc|channel|removeChannel)$/]",
          message: "Use the API client in src/lib/api instead of querying Supabase directly.",
        },
        {
          selector: "MemberExpression[object.object.name='supabase'][object.property.name='functions']",
          message: "Edge functions were retired; add an API endpoint instead.",
        },
      ],
    },
  }
);
