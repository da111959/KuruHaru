import { createAsmrRepository } from "./repository";

export function createAsmrService(repository = createAsmrRepository()) {
  return {
    syncCloudWorks: (options) => repository.syncCloudWorks(options),
    login: (sender, params) => repository.login(sender, params),
    checkLogin: () => repository.checkLogin(),
    logout: () => repository.logout(),
  };
}
