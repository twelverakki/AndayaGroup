import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("kennan-ui", "routes/kennan-ui.tsx"),
] satisfies RouteConfig;
