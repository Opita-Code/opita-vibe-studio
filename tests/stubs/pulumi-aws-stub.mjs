// Test-only stub for the @pulumi/aws SDK.
//
// The real @pulumi/aws lives inside .sst/platform/node_modules (bundled by
// SST) and is not resolvable from the repo root, so vitest cannot transform
// sst.config.ts's `await import("@pulumi/aws")`. vite.config.ts aliases the
// specifier here purely for tests; the app build never imports @pulumi/aws
// (sst.config.ts is not part of the Vite bundle). Tests override this module
// via vi.mock to assert on the SSM calls.
export const ssm = {
  getParameter() {
    throw new Error("@pulumi/aws ssm stub: not mocked in this test");
  },
};

export default { ssm };
