import { startClient } from "@/telegram/client";
import type { TdMessage } from "@/telegram/types";
import { documentFileOf, localPathOf, sendDocument } from "@/telegram/upload";

import { installFakeTdLib, removeFakeTdLib } from "./fakeTdLib";

const CAPTION = 'fileharbor:1:{"path":["Goa 2024"],"name":"IMG_1.jpg"}';

const message = (
  id: number,
  pending: boolean,
  text = CAPTION,
  chatId = 42,
): TdMessage => ({
  "@type": "message",
  id,
  chat_id: chatId,
  date: 0,
  sending_state: pending ? { "@type": "messageSendingStatePending" } : null,
  content: {
    "@type": "messageDocument",
    caption: { "@type": "formattedText", text },
    document: {
      "@type": "document",
      file_name: "IMG_1.jpg",
      mime_type: "image/jpeg",
      document: { "@type": "file", id: 7, size: 100, expected_size: 100 },
    },
  },
});

describe("localPathOf", () => {
  it("gives the plain path of a file URI, decoded", () => {
    expect(localPathOf("file:///data/user/0/app/cache/My%20trip.jpg")).toBe(
      "/data/user/0/app/cache/My trip.jpg",
    );
    expect(localPathOf("/data/x.jpg")).toBe("/data/x.jpg");
  });

  it("gives null for a URI that TDLib cannot open (spec §12.3)", () => {
    expect(localPathOf("content://media/external/images/1")).toBeNull();
  });
});

describe("sendDocument", () => {
  let fake: ReturnType<typeof installFakeTdLib>;

  beforeEach(async () => {
    fake = installFakeTdLib();
    await startClient({ apiId: 1, apiHash: "h" });
  });
  afterEach(removeFakeTdLib);

  it("sends a document with the caption, the thumbnail, and no content detection", async () => {
    const done = sendDocument({
      chatId: 42,
      path: "/data/cache/IMG_1.jpg",
      caption: CAPTION,
      thumbnail: { path: "/data/cache/t.jpg", width: 320, height: 240 },
    });
    expect(fake.td.td_json_client_send).toHaveBeenCalledWith({
      "@type": "sendMessage",
      chat_id: 42,
      input_message_content: {
        "@type": "inputMessageDocument",
        document: { "@type": "inputFileLocal", path: "/data/cache/IMG_1.jpg" },
        caption: { "@type": "formattedText", text: CAPTION },
        disable_content_type_detection: true,
        thumbnail: {
          "@type": "inputThumbnail",
          thumbnail: { "@type": "inputFileLocal", path: "/data/cache/t.jpg" },
          width: 320,
          height: 240,
        },
      },
    });
    fake.emit({ "@type": "updateNewMessage", message: message(-1, true) });
    fake.emit({
      "@type": "updateMessageSendSucceeded",
      old_message_id: -1,
      message: message(100, false),
    });
    await expect(done).resolves.toEqual({
      ok: true,
      value: message(100, false),
    });
  });

  it("sends no thumbnail field when there is none", () => {
    void sendDocument({
      chatId: 42,
      path: "/data/a.pdf",
      caption: CAPTION,
      thumbnail: null,
    });
    const request = fake.td.td_json_client_send.mock.calls[0][0] as {
      input_message_content: Record<string, unknown>;
    };
    expect(request.input_message_content).not.toHaveProperty("thumbnail");
  });

  it("matches only its own pending message: same chat and same caption", async () => {
    const onPending = jest.fn();
    const done = sendDocument(
      { chatId: 42, path: "/a", caption: CAPTION, thumbnail: null },
      onPending,
    );
    fake.emit({
      "@type": "updateNewMessage",
      message: message(-3, true, "fileharbor:1:other"),
    });
    fake.emit({
      "@type": "updateNewMessage",
      message: message(-2, true, CAPTION, 99),
    });
    fake.emit({ "@type": "updateNewMessage", message: message(-1, true) });
    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledWith(message(-1, true));
    fake.emit({
      "@type": "updateMessageSendFailed",
      old_message_id: -1,
      message: message(-1, false),
      error: { code: 400, message: "FILE_PARTS_INVALID" },
    });
    await expect(done).resolves.toEqual({
      ok: false,
      error: { kind: "tdlib", message: "FILE_PARTS_INVALID" },
    });
  });
});

describe("documentFileOf", () => {
  it("gives the document file, and null for another content", () => {
    expect(documentFileOf(message(-1, true))?.id).toBe(7);
    expect(
      documentFileOf({
        ...message(1, false),
        content: { "@type": "messageText" },
      }),
    ).toBeNull();
  });
});
