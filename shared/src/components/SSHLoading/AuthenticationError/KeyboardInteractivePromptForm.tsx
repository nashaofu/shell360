import { Button, Text, TextField } from "@radix-ui/themes";
import { type ChangeEvent, useState } from "react";

import { TextFieldPassword } from "../../TextFieldPassword";
import { StatusButton } from "../common";
import ErrorText from "../ErrorText";
import styles from "../styles.module.less";

export type KeyboardInteractivePrompt = {
  prompt: string;
  echo: boolean;
};

export type KeyboardInteractiveData = {
  name?: string;
  instructions?: string;
  prompts: KeyboardInteractivePrompt[];
};

export type KeyboardInteractivePromptFormProps = {
  data: KeyboardInteractiveData;
  onSubmit: (answers: string[]) => unknown;
  onClose: () => unknown;
};

export function KeyboardInteractivePromptForm({
  data,
  onSubmit,
  onClose,
}: KeyboardInteractivePromptFormProps) {
  const [answers, setAnswers] = useState<string[]>(() =>
    data.prompts.map(() => ""),
  );
  const [submitting, setSubmitting] = useState(false);

  const onChangeAnswer = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const title = data.name?.trim() || "Keyboard interactive authentication";

  return (
    <form
      className={styles.authForm}
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting) {
          return;
        }
        setSubmitting(true);
        onSubmit(answers);
      }}
    >
      <ErrorText
        title={title}
        message={data.instructions?.trim() || "Please answer the prompts."}
      />
      {data.prompts.map((prompt, index) => {
        const key = `${index}-${prompt.prompt}`;
        return (
          <div className={styles.formField} key={key}>
            <Text
              as="label"
              size="2"
              weight="medium"
              className={styles.fieldLabel}
            >
              {prompt.prompt}
            </Text>
            {prompt.echo ? (
              <TextField.Root
                value={answers[index] ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChangeAnswer(index, event.target.value)
                }
              />
            ) : (
              <TextFieldPassword
                value={answers[index] ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChangeAnswer(index, event.target.value)
                }
              />
            )}
          </div>
        );
      })}
      <div className={styles.actions}>
        <StatusButton variant="outlined" onClick={onClose}>
          Close
        </StatusButton>
        <Button
          type="submit"
          className={styles.statusButton}
          loading={submitting}
        >
          Submit
        </Button>
      </div>
    </form>
  );
}
