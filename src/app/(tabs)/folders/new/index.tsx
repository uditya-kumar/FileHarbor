import { useRouter } from "expo-router";
import { useState } from "react";

import { Button } from "@components/fileHarbourComponent/shared/Button";
import { ButtonRow } from "@components/fileHarbourComponent/shared/ButtonRow";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { InputField } from "@components/fileHarbourComponent/shared/InputField";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SectionHeader } from "@components/fileHarbourComponent/shared/SectionHeader";
import { SheetGrabber } from "@components/fileHarbourComponent/shared/SheetGrabber";
import { childDirPath, MAX_NAME_LENGTH, ROOT_DIR_PATH } from "@/format/caption";
import { addLocalDir } from "@/index/db";

// 06 new folder sheet. A folder is not an object on Telegram: its name goes into the caption
// of each file in it (spec §1). Until the first upload, the folder is on this device only.

function nameError(name: string): string {
  if (name.includes("/")) return 'A folder name cannot have "/".';
  if (name === "." || name === "..") return "This name is not allowed.";
  return "The name has a character that is not allowed.";
}

export default function NewFolderScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  const onChangeName = (value: string): void => {
    setName(value);
    setError(undefined);
  };

  const create = async (): Promise<void> => {
    if (!trimmed || saving) return;
    const dirPath = childDirPath(ROOT_DIR_PATH, trimmed);
    if (dirPath === null) {
      setError(nameError(trimmed));
      return;
    }
    setSaving(true);
    const result = await addLocalDir(dirPath);
    setSaving(false);
    if (!result.ok) setError(`The folder was not saved (${result.message}).`);
    else if (result.value === "exists")
      setError(`A folder named "${trimmed}" exists.`);
    else router.back();
  };

  return (
    <Screen
      fit
      footer={
        <ButtonRow>
          <Button
            label="Cancel"
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => router.back()}
          />
          <Button
            label="Create"
            size="md"
            fullWidth
            disabled={!trimmed}
            loading={saving}
            onPress={() => void create()}
          />
        </ButtonRow>
      }
    >
      <SheetGrabber />
      <FormBody dense>
        <SectionHeader title="New folder" level="sheet" />
        <InputField
          label="Name"
          value={name}
          onChangeText={onChangeName}
          placeholder="e.g. Goa 2024"
          autoCapitalize="sentences"
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void create()}
          error={error}
          hint="The folder is saved on Telegram with its first file. Its name goes into the caption of each file in it."
          hintIcon="info"
        />
      </FormBody>
    </Screen>
  );
}
