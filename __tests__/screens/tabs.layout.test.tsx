import { act, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import TabsLayout from "@/app/(tabs)/_layout";
import { fetchFile, watchFiles } from "@/index/sync";
import { addDownloads, resetDownloadsForTests } from "@/transfer/downloads";
import type { FolderFile, ServiceResult } from "@/types/domain";

// NativeTabs is native. The mock shows each trigger and its badge as text.
jest.mock("expo-router/unstable-native-tabs", () => {
  const { Text, View } =
    require("react-native") as typeof import("react-native");
  const Trigger = ({
    name,
    children,
  }: {
    name: string;
    children: ReactNode;
  }) => <View testID={`tab-${name}`}>{children}</View>;
  Trigger.Label = ({ children }: { children: ReactNode }) => (
    <Text>{children}</Text>
  );
  Trigger.Icon = () => null;
  // The expo-router rule (NativeTabTrigger appendBadgeOptions): a value always shows, also
  // with `hidden`. Only a badge with no value can hide.
  Trigger.Badge = ({
    hidden,
    children,
  }: {
    hidden?: boolean;
    children?: ReactNode;
  }) =>
    children ? (
      <Text testID="badge">{children}</Text>
    ) : hidden ? null : (
      <Text testID="badge"> </Text>
    );
  const NativeTabs = ({ children }: { children: ReactNode }) => (
    <View>{children}</View>
  );
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
jest.mock("@/index/sync", () => ({
  fetchFile: jest.fn(),
  stopFile: jest.fn(),
  watchFiles: jest.fn(() => () => {}),
}));

const fetch = fetchFile as jest.Mock;
const pending = new Map<number, (r: ServiceResult<string>) => void>();

const file = (fileId: number): FolderFile => ({
  messageId: fileId,
  dirPath: "",
  name: `IMG_${fileId}.jpg`,
  date: 1,
  size: 100,
  mimeType: "image/jpeg",
  kind: "photo",
  fileId,
  localUri: null,
  thumbnailFileId: null,
  thumbnailUri: null,
  placeholderUri: null,
});

beforeEach(() => {
  resetDownloadsForTests();
  (watchFiles as jest.Mock).mockImplementation(() => () => {});
  pending.clear();
  fetch.mockReset().mockImplementation(
    (fileId: number) =>
      new Promise<ServiceResult<string>>((resolve) => {
        pending.set(fileId, resolve);
      }),
  );
});

describe("Tabs layout — Downloads badge", () => {
  it("shows the tabs in order, with no badge at zero", async () => {
    await render(<TabsLayout />);
    expect(screen.getByText("Folders")).toBeOnTheScreen();
    expect(screen.getByText("Downloads")).toBeOnTheScreen();
    expect(screen.getByText("Settings")).toBeOnTheScreen();
    expect(screen.queryByTestId("badge")).toBeNull();
  });

  it("shows the count of files that download, on the Downloads tab", async () => {
    await render(<TabsLayout />);
    await act(() => {
      addDownloads([1, 2, 3].map(file));
    });
    expect(screen.getByTestId("badge")).toHaveTextContent("3");
    expect(screen.getByTestId("tab-transfers")).toContainElement(
      screen.getByTestId("badge"),
    );
    await act(async () => {
      [1, 2, 3].forEach((id) =>
        pending.get(id)?.({ ok: true, value: `file:///td/${id}` }),
      );
    });
    expect(screen.queryByTestId("badge")).toBeNull();
  });
});
