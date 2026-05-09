import { Flex } from "@radix-ui/themes";
import Content from "./Content";
import TitleBar from "./TitleBar";

export default function Root() {
  return (
    <>
      <TitleBar />
      <Flex direction="row" width="100%" height="100%">
        <Content></Content>
      </Flex>
    </>
  );
}
