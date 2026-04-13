"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, GripVertical, Trash2 } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useI18n } from "@/components/language-provider";

type ModalVariable = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

type ModalEnvironment = {
  id: string;
  name: string;
  variables: ModalVariable[];
};

type Scope = "local" | "global";

const ENVIRONMENT_DND_PREFIX = "environment";
const VARIABLE_DND_PREFIX = "variable";

const createEnvironmentDndId = (scope: Scope, environmentId: string) =>
  `${ENVIRONMENT_DND_PREFIX}:${scope}:${environmentId}`;

const parseEnvironmentDndId = (value: string): { scope: Scope; environmentId: string } | null => {
  const [prefix, scope, environmentId] = value.split(":");

  if (
    prefix !== ENVIRONMENT_DND_PREFIX ||
    (scope !== "local" && scope !== "global") ||
    !environmentId
  ) {
    return null;
  }

  return {
    scope,
    environmentId,
  };
};

const createVariableDndId = (scope: Scope, environmentId: string, variableId: string) =>
  `${VARIABLE_DND_PREFIX}:${scope}:${environmentId}:${variableId}`;

const parseVariableDndId = (
  value: string,
): { scope: Scope; environmentId: string; variableId: string } | null => {
  const [prefix, scope, environmentId, variableId] = value.split(":");

  if (
    prefix !== VARIABLE_DND_PREFIX ||
    (scope !== "local" && scope !== "global") ||
    !environmentId ||
    !variableId
  ) {
    return null;
  }

  return {
    scope,
    environmentId,
    variableId,
  };
};

type SortableEnvironmentRowProps = {
  dndId: string;
  activeDragId: string | null;
  environment: ModalEnvironment;
  isSelected: boolean;
  isActive: boolean;
  isNameEditing: boolean;
  editingName: string;
  isDeletePending: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onEditingNameChange: (value: string) => void;
  onCommitEditingName: () => void;
  onCancelEditingName: () => void;
  onDelete: () => void;
};

const SortableEnvironmentRow = ({
  dndId,
  activeDragId,
  environment,
  isSelected,
  isActive,
  isNameEditing,
  editingName,
  isDeletePending,
  onSelect,
  onStartEditing,
  onEditingNameChange,
  onCommitEditingName,
  onCancelEditingName,
  onDelete,
}: SortableEnvironmentRowProps) => {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
    id: dndId,
  });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: dndId,
  });

  const setCombinedRef = (element: HTMLDivElement | null) => {
    setDraggableNodeRef(element);
    setDroppableNodeRef(element);
  };

  const rowStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const isDropTarget = Boolean(activeDragId) && activeDragId !== dndId && isOver;
  const dragInteractionProps = isNameEditing ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setCombinedRef}
      style={rowStyle}
      className={`relative flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition ${
        isSelected
          ? "border-violet-300/55 bg-violet-500/20 hover:border-violet-200/90 hover:bg-violet-500/35 hover:shadow-[0_0_0_1px_rgba(196,181,253,0.35)]"
          : "border-white/10 bg-[#18142d] hover:border-violet-300/45 hover:bg-[#25203b] hover:shadow-[0_0_0_1px_rgba(196,181,253,0.25)]"
      }`}
      {...dragInteractionProps}
    >
      {isDropTarget && (
        <div className="pointer-events-none absolute -top-1 left-0 right-0 h-px bg-violet-400/90" />
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onDoubleClick={onStartEditing}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        {isNameEditing ? (
          <input
            autoFocus
            value={editingName}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onEditingNameChange(event.target.value)}
            onBlur={onCommitEditingName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitEditingName();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancelEditingName();
              }
            }}
            className="h-8 w-full min-w-0 rounded-md border border-violet-300/45 bg-[#0f0c1f] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
          />
        ) : (
          <span className="truncate text-zinc-100">{environment.name}</span>
        )}

        {isActive && (
          <span className="rounded-full border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
            {t("env.activeTag")}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
          isDeletePending
            ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
            : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
        }`}
        aria-label={isDeletePending ? t("env.deleteEnvironmentConfirm") : t("env.deleteEnvironment")}
        title={isDeletePending ? t("env.deleteEnvironmentConfirm") : t("env.deleteEnvironment")}
      >
        {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
};

type SortableVariableRowProps = {
  dndId: string;
  activeDragId: string | null;
  variable: ModalVariable;
  isDeletePending: boolean;
  onToggleEnabled: () => void;
  onKeyChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onDelete: () => void;
};

const SortableVariableRow = ({
  dndId,
  activeDragId,
  variable,
  isDeletePending,
  onToggleEnabled,
  onKeyChange,
  onValueChange,
  onDelete,
}: SortableVariableRowProps) => {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
    id: dndId,
  });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: dndId,
  });

  const setCombinedRef = (element: HTMLDivElement | null) => {
    setDraggableNodeRef(element);
    setDroppableNodeRef(element);
  };

  const rowStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const isDropTarget = Boolean(activeDragId) && activeDragId !== dndId && isOver;

  return (
    <div
      ref={setCombinedRef}
      style={rowStyle}
      className={`relative grid gap-2 md:grid-cols-[28px_48px_minmax(0,1fr)_minmax(0,1fr)_40px]`}
    >
      {isDropTarget && (
        <div className="pointer-events-none absolute -top-1 left-0 right-0 h-px bg-violet-400/90" />
      )}

      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 bg-[#0f0c1f] text-zinc-300 transition hover:border-violet-300/50 hover:text-violet-100"
        aria-label={t("env.dragVariable")}
        title={t("env.dragVariable")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggleEnabled}
        className={`flex h-10 items-center justify-center rounded-lg border transition ${
          variable.enabled
            ? "border-emerald-300/60 bg-emerald-500/15 hover:bg-emerald-500/20"
            : "border-white/15 bg-[#121025] hover:bg-white/10"
        }`}
        aria-pressed={variable.enabled}
        aria-label={variable.enabled ? t("table.toggleOff") : t("table.toggleOn")}
      >
        <span className={`relative h-5 w-9 rounded-full transition ${variable.enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
              variable.enabled ? "translate-x-4" : ""
            }`}
          />
        </span>
      </button>

      <input
        value={variable.key}
        onChange={(event) => onKeyChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
        placeholder="api_host"
      />

      <input
        value={variable.value}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
        placeholder="http://localhost:8080"
      />

      <button
        type="button"
        onClick={onDelete}
        className={`inline-flex h-10 items-center justify-center rounded-lg border transition ${
          isDeletePending
            ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
            : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
        }`}
        aria-label={isDeletePending ? t("env.deleteVariableConfirm") : t("env.deleteVariable")}
        title={isDeletePending ? t("env.deleteVariableConfirm") : t("env.deleteVariable")}
      >
        {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
};

type EnvironmentModalProps = {
  environments: ModalEnvironment[];
  globalEnvironments: ModalEnvironment[];
  collection: { activeEnvironmentId: string | null };
  globalEnvironmentState: { activeEnvironmentId: string | null };
  editingEnvironment: ModalEnvironment | null;
  editingGlobalEnvironment: ModalEnvironment | null;
  reorderEnvironment: (sourceEnvironmentId: string, targetEnvironmentId: string) => void;
  reorderGlobalEnvironment: (sourceEnvironmentId: string, targetEnvironmentId: string) => void;
  reorderEnvironmentVariable: (
    environmentId: string,
    sourceVariableId: string,
    targetVariableId: string,
  ) => void;
  reorderGlobalEnvironmentVariable: (
    environmentId: string,
    sourceVariableId: string,
    targetVariableId: string,
  ) => void;
  [key: string]: any;
};

export const EnvironmentModal = (props: EnvironmentModalProps) => {
  const { t } = useI18n();
  const {
    isEnvironmentModalOpen,
    closeEnvironmentModal,
    setEnvironmentModalScope,
    environmentModalScope,
    newEnvironmentName,
    setNewEnvironmentName,
    createEnvironment,
    environments,
    editingEnvironmentId,
    collection,
    editingEnvironmentNameId,
    pendingDeleteEnvironmentId,
    setEditingEnvironmentId,
    startEditingEnvironmentName,
    editingEnvironmentName,
    setEditingEnvironmentName,
    commitEditingEnvironmentName,
    cancelEditingEnvironmentName,
    handleDeleteEnvironmentClick,
    reorderEnvironment,
    newGlobalEnvironmentName,
    setNewGlobalEnvironmentName,
    createGlobalEnvironment,
    globalEnvironments,
    editingGlobalEnvironmentId,
    globalEnvironmentState,
    editingGlobalEnvironmentNameId,
    pendingDeleteGlobalEnvironmentId,
    setEditingGlobalEnvironmentId,
    startEditingGlobalEnvironmentName,
    editingGlobalEnvironmentName,
    setEditingGlobalEnvironmentName,
    commitEditingGlobalEnvironmentName,
    cancelEditingGlobalEnvironmentName,
    handleDeleteGlobalEnvironmentClick,
    reorderGlobalEnvironment,
    editingEnvironment,
    setActiveEnvironmentId,
    pendingDeleteEnvironmentVariableKey,
    updateEnvironmentVariable,
    handleRemoveEnvironmentVariableClick,
    addEnvironmentVariable,
    reorderEnvironmentVariable,
    editingGlobalEnvironment,
    setActiveGlobalEnvironmentId,
    pendingDeleteGlobalEnvironmentVariableKey,
    updateGlobalEnvironmentVariable,
    handleRemoveGlobalEnvironmentVariableClick,
    addGlobalEnvironmentVariable,
    reorderGlobalEnvironmentVariable,
  } = props;

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const [activeLocalEnvironmentDragId, setActiveLocalEnvironmentDragId] = useState<string | null>(null);
  const [activeGlobalEnvironmentDragId, setActiveGlobalEnvironmentDragId] = useState<string | null>(null);
  const [activeLocalVariableDragId, setActiveLocalVariableDragId] = useState<string | null>(null);
  const [activeGlobalVariableDragId, setActiveGlobalVariableDragId] = useState<string | null>(null);

  const handleLocalEnvironmentDragStart = (event: DragStartEvent) => {
    setActiveLocalEnvironmentDragId(String(event.active.id));
  };

  const handleLocalEnvironmentDragCancel = () => {
    setActiveLocalEnvironmentDragId(null);
  };

  const handleLocalEnvironmentDragEnd = (event: DragEndEvent) => {
    setActiveLocalEnvironmentDragId(null);

    if (!event.over?.id) {
      return;
    }

    const active = parseEnvironmentDndId(String(event.active.id));
    const over = parseEnvironmentDndId(String(event.over.id));

    if (!active || !over || active.scope !== "local" || over.scope !== "local") {
      return;
    }

    reorderEnvironment(active.environmentId, over.environmentId);
  };

  const handleGlobalEnvironmentDragStart = (event: DragStartEvent) => {
    setActiveGlobalEnvironmentDragId(String(event.active.id));
  };

  const handleGlobalEnvironmentDragCancel = () => {
    setActiveGlobalEnvironmentDragId(null);
  };

  const handleGlobalEnvironmentDragEnd = (event: DragEndEvent) => {
    setActiveGlobalEnvironmentDragId(null);

    if (!event.over?.id) {
      return;
    }

    const active = parseEnvironmentDndId(String(event.active.id));
    const over = parseEnvironmentDndId(String(event.over.id));

    if (!active || !over || active.scope !== "global" || over.scope !== "global") {
      return;
    }

    reorderGlobalEnvironment(active.environmentId, over.environmentId);
  };

  const handleLocalVariableDragStart = (event: DragStartEvent) => {
    setActiveLocalVariableDragId(String(event.active.id));
  };

  const handleLocalVariableDragCancel = () => {
    setActiveLocalVariableDragId(null);
  };

  const handleLocalVariableDragEnd = (event: DragEndEvent) => {
    setActiveLocalVariableDragId(null);

    if (!event.over?.id) {
      return;
    }

    const active = parseVariableDndId(String(event.active.id));
    const over = parseVariableDndId(String(event.over.id));

    if (!active || !over || active.scope !== "local" || over.scope !== "local") {
      return;
    }

    if (active.environmentId !== over.environmentId) {
      return;
    }

    reorderEnvironmentVariable(active.environmentId, active.variableId, over.variableId);
  };

  const handleGlobalVariableDragStart = (event: DragStartEvent) => {
    setActiveGlobalVariableDragId(String(event.active.id));
  };

  const handleGlobalVariableDragCancel = () => {
    setActiveGlobalVariableDragId(null);
  };

  const handleGlobalVariableDragEnd = (event: DragEndEvent) => {
    setActiveGlobalVariableDragId(null);

    if (!event.over?.id) {
      return;
    }

    const active = parseVariableDndId(String(event.active.id));
    const over = parseVariableDndId(String(event.over.id));

    if (!active || !over || active.scope !== "global" || over.scope !== "global") {
      return;
    }

    if (active.environmentId !== over.environmentId) {
      return;
    }

    reorderGlobalEnvironmentVariable(active.environmentId, active.variableId, over.variableId);
  };

  return (
    <>
      {isEnvironmentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 pb-4 pl-4 pr-4 pt-14"
          onClick={closeEnvironmentModal}
        >
          <div
            className="flex max-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#151225] shadow-[0_12px_42px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">{t("env.manage")}</h2>
              <button
                type="button"
                onClick={closeEnvironmentModal}
                className="rounded-md border border-white/20 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10"
              >
                {t("common.close")}
              </button>
            </div>

            <div className="grid min-h-[420px] min-h-0 flex-1 gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#121025] p-3">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEnvironmentModalScope("local")}
                    className={`h-8 rounded-md border text-xs font-medium transition ${
                      environmentModalScope === "local"
                        ? "border-violet-300/55 bg-violet-500/25 text-violet-100"
                        : "border-white/15 bg-[#0e0b1c] text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {t("env.locals")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironmentModalScope("global")}
                    className={`h-8 rounded-md border text-xs font-medium transition ${
                      environmentModalScope === "global"
                        ? "border-violet-300/55 bg-violet-500/25 text-violet-100"
                        : "border-white/15 bg-[#0e0b1c] text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {t("env.globals")}
                  </button>
                </div>

                {environmentModalScope === "local" ? (
                  <>
                    <div className="space-y-2">
                      <input
                        value={newEnvironmentName}
                        onChange={(event) => setNewEnvironmentName(event.target.value)}
                        className="h-9 w-full rounded-md border border-white/15 bg-[#0e0b1c] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                        placeholder={t("env.localPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={createEnvironment}
                        className="h-9 w-full rounded-md border border-violet-300/45 bg-violet-500/15 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
                      >
                        {t("env.createLocal")}
                      </button>
                    </div>

                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleLocalEnvironmentDragStart}
                      onDragEnd={handleLocalEnvironmentDragEnd}
                      onDragCancel={handleLocalEnvironmentDragCancel}
                    >
                      <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto pr-1">
                        {environments.length === 0 && (
                          <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-zinc-400">
                            {t("env.noneLocal")}
                          </p>
                        )}

                        {environments.map((environment) => {
                          const isSelected = editingEnvironmentId === environment.id;
                          const isActive = collection.activeEnvironmentId === environment.id;
                          const isNameEditing = editingEnvironmentNameId === environment.id;
                          const isDeletePending = pendingDeleteEnvironmentId === environment.id;

                          return (
                            <SortableEnvironmentRow
                              key={environment.id}
                              dndId={createEnvironmentDndId("local", environment.id)}
                              activeDragId={activeLocalEnvironmentDragId}
                              environment={environment}
                              isSelected={isSelected}
                              isActive={isActive}
                              isNameEditing={isNameEditing}
                              editingName={editingEnvironmentName}
                              isDeletePending={isDeletePending}
                              onSelect={() => setEditingEnvironmentId(environment.id)}
                              onStartEditing={() => startEditingEnvironmentName(environment.id, environment.name)}
                              onEditingNameChange={setEditingEnvironmentName}
                              onCommitEditingName={commitEditingEnvironmentName}
                              onCancelEditingName={cancelEditingEnvironmentName}
                              onDelete={() => handleDeleteEnvironmentClick(environment.id)}
                            />
                          );
                        })}
                      </div>
                    </DndContext>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <input
                        value={newGlobalEnvironmentName}
                        onChange={(event) => setNewGlobalEnvironmentName(event.target.value)}
                        className="h-9 w-full rounded-md border border-white/15 bg-[#0e0b1c] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                        placeholder={t("env.globalPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={createGlobalEnvironment}
                        className="h-9 w-full rounded-md border border-violet-300/45 bg-violet-500/15 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
                      >
                        {t("env.createGlobal")}
                      </button>
                    </div>
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleGlobalEnvironmentDragStart}
                      onDragEnd={handleGlobalEnvironmentDragEnd}
                      onDragCancel={handleGlobalEnvironmentDragCancel}
                    >
                      <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto pr-1">
                        {globalEnvironments.length === 0 && (
                          <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-zinc-400">
                            {t("env.noneGlobal")}
                          </p>
                        )}

                        {globalEnvironments.map((environment) => {
                          const isSelected = editingGlobalEnvironmentId === environment.id;
                          const isActive = globalEnvironmentState.activeEnvironmentId === environment.id;
                          const isNameEditing = editingGlobalEnvironmentNameId === environment.id;
                          const isDeletePending = pendingDeleteGlobalEnvironmentId === environment.id;

                          return (
                            <SortableEnvironmentRow
                              key={environment.id}
                              dndId={createEnvironmentDndId("global", environment.id)}
                              activeDragId={activeGlobalEnvironmentDragId}
                              environment={environment}
                              isSelected={isSelected}
                              isActive={isActive}
                              isNameEditing={isNameEditing}
                              editingName={editingGlobalEnvironmentName}
                              isDeletePending={isDeletePending}
                              onSelect={() => setEditingGlobalEnvironmentId(environment.id)}
                              onStartEditing={() =>
                                startEditingGlobalEnvironmentName(environment.id, environment.name)
                              }
                              onEditingNameChange={setEditingGlobalEnvironmentName}
                              onCommitEditingName={commitEditingGlobalEnvironmentName}
                              onCancelEditingName={cancelEditingGlobalEnvironmentName}
                              onDelete={() => handleDeleteGlobalEnvironmentClick(environment.id)}
                            />
                          );
                        })}
                      </div>
                    </DndContext>
                  </>
                )}
              </aside>

              <section className="flex min-h-0 flex-col overflow-hidden p-4">
                {environmentModalScope === "local" ? (
                  editingEnvironment ? (
                    <>
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <p className="truncate text-sm font-medium text-zinc-100">{editingEnvironment.name}</p>
                        <button
                          type="button"
                          onClick={() => setActiveEnvironmentId(editingEnvironment.id)}
                          className={`h-10 rounded-md border px-3 text-sm transition ${
                            collection.activeEnvironmentId === editingEnvironment.id
                              ? "border-emerald-300/55 bg-emerald-500/20 text-emerald-100"
                              : "border-white/20 text-zinc-200 hover:bg-white/10"
                          }`}
                        >
                          {collection.activeEnvironmentId === editingEnvironment.id ? t("env.localActive") : t("env.activate")}
                        </button>
                      </div>

                      <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
                        <div className="mb-2 hidden grid-cols-[28px_48px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
                          <span>{t("env.columnMove")}</span>
                          <span>{t("env.columnActive")}</span>
                          <span>{t("env.columnVariable")}</span>
                          <span>{t("env.columnValue")}</span>
                          <span>{t("env.columnAction")}</span>
                        </div>

                        <DndContext
                          sensors={dndSensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleLocalVariableDragStart}
                          onDragEnd={handleLocalVariableDragEnd}
                          onDragCancel={handleLocalVariableDragCancel}
                        >
                          <div className="space-y-2">
                            {editingEnvironment.variables.map((variable) => {
                              const variableDeleteKey = `${editingEnvironment.id}:${variable.id}`;
                              const isDeletePending = pendingDeleteEnvironmentVariableKey === variableDeleteKey;

                              return (
                                <SortableVariableRow
                                  key={variable.id}
                                  dndId={createVariableDndId("local", editingEnvironment.id, variable.id)}
                                  activeDragId={activeLocalVariableDragId}
                                  variable={variable}
                                  isDeletePending={isDeletePending}
                                  onToggleEnabled={() =>
                                    updateEnvironmentVariable(
                                      editingEnvironment.id,
                                      variable.id,
                                      "enabled",
                                      !variable.enabled,
                                    )
                                  }
                                  onKeyChange={(value) =>
                                    updateEnvironmentVariable(editingEnvironment.id, variable.id, "key", value)
                                  }
                                  onValueChange={(value) =>
                                    updateEnvironmentVariable(editingEnvironment.id, variable.id, "value", value)
                                  }
                                  onDelete={() =>
                                    handleRemoveEnvironmentVariableClick(editingEnvironment.id, variable.id)
                                  }
                                />
                              );
                            })}
                          </div>
                        </DndContext>

                        <button
                          type="button"
                          onClick={() => addEnvironmentVariable(editingEnvironment.id)}
                          className="mt-3 rounded-lg border border-violet-300/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
                        >
                          {t("env.addVariable")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-400">{t("env.emptyEditLocal")}</p>
                  )
                ) : editingGlobalEnvironment ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <p className="truncate text-sm font-medium text-zinc-100">{editingGlobalEnvironment.name}</p>
                      <button
                        type="button"
                        onClick={() => setActiveGlobalEnvironmentId(editingGlobalEnvironment.id)}
                        className={`h-10 rounded-md border px-3 text-sm transition ${
                          globalEnvironmentState.activeEnvironmentId === editingGlobalEnvironment.id
                            ? "border-emerald-300/55 bg-emerald-500/20 text-emerald-100"
                            : "border-white/20 text-zinc-200 hover:bg-white/10"
                        }`}
                        >
                          {globalEnvironmentState.activeEnvironmentId === editingGlobalEnvironment.id
                            ? t("env.globalActive")
                            : t("env.activate")}
                      </button>
                    </div>

                    <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
                      <div className="mb-2 hidden grid-cols-[28px_48px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
                        <span>{t("env.columnMove")}</span>
                        <span>{t("env.columnActive")}</span>
                        <span>{t("env.columnVariable")}</span>
                        <span>{t("env.columnValue")}</span>
                        <span>{t("env.columnAction")}</span>
                      </div>

                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleGlobalVariableDragStart}
                        onDragEnd={handleGlobalVariableDragEnd}
                        onDragCancel={handleGlobalVariableDragCancel}
                      >
                        <div className="space-y-2">
                          {editingGlobalEnvironment.variables.map((variable) => {
                            const variableDeleteKey = `${editingGlobalEnvironment.id}:${variable.id}`;
                            const isDeletePending = pendingDeleteGlobalEnvironmentVariableKey === variableDeleteKey;

                            return (
                              <SortableVariableRow
                                key={variable.id}
                                dndId={createVariableDndId("global", editingGlobalEnvironment.id, variable.id)}
                                activeDragId={activeGlobalVariableDragId}
                                variable={variable}
                                isDeletePending={isDeletePending}
                                onToggleEnabled={() =>
                                  updateGlobalEnvironmentVariable(
                                    editingGlobalEnvironment.id,
                                    variable.id,
                                    "enabled",
                                    !variable.enabled,
                                  )
                                }
                                onKeyChange={(value) =>
                                  updateGlobalEnvironmentVariable(
                                    editingGlobalEnvironment.id,
                                    variable.id,
                                    "key",
                                    value,
                                  )
                                }
                                onValueChange={(value) =>
                                  updateGlobalEnvironmentVariable(
                                    editingGlobalEnvironment.id,
                                    variable.id,
                                    "value",
                                    value,
                                  )
                                }
                                onDelete={() =>
                                  handleRemoveGlobalEnvironmentVariableClick(
                                    editingGlobalEnvironment.id,
                                    variable.id,
                                  )
                                }
                              />
                            );
                          })}
                        </div>
                      </DndContext>

                      <button
                        type="button"
                        onClick={() => addGlobalEnvironmentVariable(editingGlobalEnvironment.id)}
                        className="mt-3 rounded-lg border border-violet-300/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
                      >
                        {t("env.addVariable")}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400">{t("env.emptyEditGlobal")}</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
