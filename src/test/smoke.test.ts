import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { expect, test } from "vitest";

test("renders a component with jest-dom matchers", () => {
  render(createElement("div", null, "Live Q&A smoke test"));

  expect(screen.getByText("Live Q&A smoke test")).toBeInTheDocument();
});
