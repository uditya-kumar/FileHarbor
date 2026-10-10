import "react-native-gesture-handler/jestSetup";
import mockSafeAreaContext from "react-native-safe-area-context/jest/mock";

jest.mock("react-native-safe-area-context", () => mockSafeAreaContext);

// FlashList v2 measures its views before it renders rows. Jest has no layout, so give it a
// phone-sized window. (The package's jestSetup.js maps FlashList to a RecyclerView export
// that 2.0.2 does not have, so it is not used.)
jest.mock("@shopify/flash-list/dist/recyclerview/utils/measureLayout", () => {
  const actual = jest.requireActual(
    "@shopify/flash-list/dist/recyclerview/utils/measureLayout",
  );
  const box = (width: number, height: number) => () => ({
    x: 0,
    y: 0,
    width,
    height,
  });
  return {
    ...actual,
    measureParentSize: jest.fn(box(400, 900)),
    measureFirstChildLayout: jest.fn(box(400, 900)),
    measureItemLayout: jest.fn(box(400, 68)),
  };
});
