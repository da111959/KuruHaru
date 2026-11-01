import { syncCloudWorksData } from "../../modules/asmr-localization";
import {
  checkLoginStatus_,
  login_,
  logout_,
} from "./auth-service";

export function createAsmrRepository() {
  return {
    syncCloudWorks: syncCloudWorksData,
    login: login_,
    checkLogin: checkLoginStatus_,
    logout: logout_,
  };
}
