"use server";

import { run } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ClientType, NoteKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { str } from "@/lib/format";

function validateClientData(data: ReturnType<typeof clientData>) {
  if (!data.name || !data.phone || !data.city || !data.address) {
    throw new Error("Le nom, le téléphone, la ville et l’adresse du client sont obligatoires.");
  }
  if (data.type === "PHYSIQUE" && (!data.cin || !data.cinExpiryDate || !data.fatherName || !data.motherName)) {
    throw new Error("Pour une personne physique, la CIN, sa date d’expiration et les noms des deux parents sont obligatoires.");
  }
  if (data.type === "MORALE" && (!data.contact || !data.ice || !data.rc || !data.ifiscal)) {
    throw new Error("Pour une personne morale, l’interlocuteur, l’ICE, le RC et l’IF sont obligatoires.");
  }
  if (data.cinExpiryDate && Number.isNaN(data.cinExpiryDate.getTime())) {
    throw new Error("La date d’expiration de la CIN est invalide.");
  }
}

const clientData = (fd: FormData) => ({
  type: (str(fd, "type") ?? "PHYSIQUE") as ClientType,
  name: str(fd, "name") ?? "",
  contact: str(fd, "contact"),
  cin: str(fd, "cin"),
  cinExpiryDate: str(fd, "cinExpiryDate") ? new Date(String(str(fd, "cinExpiryDate")) + "T00:00:00") : null,
  fatherName: str(fd, "fatherName"),
  motherName: str(fd, "motherName"),
  ice: str(fd, "ice"),
  rc: str(fd, "rc"),
  ifiscal: str(fd, "ifiscal"),
  address: str(fd, "address"),
  city: str(fd, "city"),
  phone: str(fd, "phone"),
  email: str(fd, "email"),
  notes: str(fd, "notes"),
});

export async function createClient(fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageClients");
    const data = clientData(fd);
    validateClientData(data);
    const client = await prisma.client.create({ data });
    await Promise.all([
      audit(user, { entity: "Client", entityId: client.id, action: "création", summary: `Client « ${client.name} » créé` }),
      notifyRoles(user, ["GERANT", "ASSISTANTE"], { title: `Nouveau client : ${client.name}`, body: `Fiche créée par ${user.name}.`, href: `/clients/${client.id}` }),
    ]);
    redirect(`/clients/${client.id}`);
  });
}

export async function updateClient(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageClients");
    const data = clientData(fd);
    validateClientData(data);
    await prisma.client.update({ where: { id }, data });
    await audit(user, { entity: "Client", entityId: id, action: "modification", summary: `Fiche client « ${data.name} » modifiée` });
    redirect(`/clients/${id}`);
  });
}

export async function addClientNote(clientId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageClients");
    const content = str(fd, "content");
    if (!content) return;
    const date = str(fd, "date");
    await prisma.clientNote.create({
      data: {
        clientId,
        authorId: user.id,
        kind: (str(fd, "kind") ?? "OBSERVATION") as NoteKind,
        content,
        date: date ? new Date(date) : new Date(),
      },
    });
    revalidatePath(`/clients/${clientId}`);
  });
}

