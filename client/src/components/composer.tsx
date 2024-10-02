import { forwardRef, useImperativeHandle, useRef } from "react";
import { Tldraw, TLDrawShape, useEditor } from "tldraw";

export function Composer() {
  const ref = useRef<ScribbleGetterRef>(null!);

  function handlePost() {
    console.log(ref.current.getScribble());
  }

  return (
    <div className="w-full max-w-96 flex flex-col gap-2">
      <Tldraw
        hideUi
        className="aspect-video w-full rounded-lg border"
        onMount={(editor) => {
          editor.setCurrentTool("draw");
        }}
      >
        <ScribbleGetter ref={ref} />
      </Tldraw>
      <div className="w-full justify-end flex gap-2">
        <button
          className="rounded bg-blue-500 px-4 py-1 text-white"
          onClick={handlePost}
        >
          Post Scribble
        </button>
      </div>
    </div>
  );
}

type ScribbleItem = {
  x: number;
  y: number;
  points: { x: number; y: number; z?: number }[];
};

interface ScribbleGetterRef {
  getScribble: () => ScribbleItem[];
  clear: () => void;
}

const ScribbleGetter = forwardRef<ScribbleGetterRef>((_, ref) => {
  const editor = useEditor();

  useImperativeHandle(ref, () => ({
    getScribble() {
      return editor.store
        .allRecords()
        .filter(
          (record) => record.typeName === "shape" && record.type === "draw",
        )
        .map((record) => {
          const {
            x,
            y,
            props: { segments },
          } = record as TLDrawShape;

          return {
            x,
            y,
            points: segments[0]?.points ?? [],
          };
        });
    },
    clear() {
      editor.store.clear();
    },
  }));

  return null;
});
