import { onMounted } from "vue";
import { useRecentActivitySelectionFilter } from "./useRecentActivitySelectionFilter";
import { useRecentActivityDownload } from "./useRecentActivityDownload";
import {
  formatRecentActivityDate,
  formatRecentActivitySize,
} from "./useRecentActivityFormatters";

export const useRecentActivityPageController = ({ message }) => {
  const selectionState = useRecentActivitySelectionFilter({ message });

  const downloadState = useRecentActivityDownload({
    selectedFiles: selectionState.selectedFiles,
    message,
  });

  onMounted(() => {
    selectionState.loadRecentActivity();
  });

  return {
    ...selectionState,
    ...downloadState,
    formatDate: formatRecentActivityDate,
    formatSize: formatRecentActivitySize,
  };
};
