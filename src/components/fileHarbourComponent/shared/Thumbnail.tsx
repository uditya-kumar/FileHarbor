import { Image } from "expo-image";
import { StyleSheet } from "react-native";

type Props = {
  /** A file:// URI of the thumbnail or the photo. null shows the placeholder only. */
  uri: string | null;
  /** A small image that shows at once, e.g. the minithumbnail data URI (spec §8.1). */
  placeholderUri?: string | null;
  /**
   * Required: a recycled list cell keeps its native image view, so without a new key it shows
   * the previous image until the new one loads (spec §8.3).
   */
  recyclingKey: string;
  /** "cover" crops to fill (07 grid, 09 filmstrip). "contain" shows all of it (09 photo). */
  fit?: "cover" | "contain";
  /** The pixel size of the loaded image. The 09 zoom needs it. */
  onLoadSize?: (size: { width: number; height: number }) => void;
};

// An image that fills its parent.
export function Thumbnail({
  uri,
  placeholderUri,
  recyclingKey,
  fit = "cover",
  onLoadSize,
}: Props) {
  return (
    <Image
      source={uri ? { uri } : null}
      placeholder={placeholderUri ? { uri: placeholderUri } : null}
      recyclingKey={recyclingKey}
      contentFit={fit}
      placeholderContentFit={fit}
      // The files are on the device already, so a disk cache would only copy them.
      cachePolicy="memory"
      transition={120}
      accessible={false}
      onLoad={
        onLoadSize
          ? (e) =>
              onLoadSize({ width: e.source.width, height: e.source.height })
          : undefined
      }
      style={StyleSheet.absoluteFill}
    />
  );
}
