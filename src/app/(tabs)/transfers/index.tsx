import { Redirect } from "expo-router";

// The tab opens on Downloads (frame 12). Uploads (frame 13) is a sibling route.
export default function TransfersIndex() {
  return <Redirect href="/transfers/downloads" />;
}
