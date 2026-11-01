import {
  registerAsmrIpcHandlers,
  registerAsmrStandaloneHandlers,
} from "../../modules/asmr-localization";

export function createAsmrIpcAdapter() {
  return {
    register: () => {
      registerAsmrIpcHandlers();
      registerAsmrStandaloneHandlers();
    },
  };
}
