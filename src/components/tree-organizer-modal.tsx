"use client";

type TreeOrganizerModalProps = {
  isOpen: boolean;
};

// Legado mantido apenas para compatibilidade interna.
// O fluxo de organizacao agora e feito diretamente por arrasta e solta na arvore.
export const TreeOrganizerModal = ({ isOpen }: TreeOrganizerModalProps) => {
  if (!isOpen) {
    return null;
  }

  return null;
};
