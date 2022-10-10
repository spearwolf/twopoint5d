import create from "zustand";

export const useDemoStore = create((set) => ({
  activeCameraName: "cam0",
  setActiveCamera: (name) => {
    set({ activeCameraName: name });
  },
}));
