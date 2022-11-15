import create from "zustand";

export const useDemoStore = create((set) => ({
  activeCameraName: "cam1",
  setActiveCamera: (name) => {
    set({ activeCameraName: name });
  },
}));
