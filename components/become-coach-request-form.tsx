"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitCoachListingApplication } from "@/app/actions/verification";
import { CoachDocumentDropzone } from "@/components/coach-document-dropzone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, IdCard } from "lucide-react";

export type BecomeCoachRequestFormProps = {
  initialBio?: string | null;
  initialEvidence?: string | null;
  initialAlreadyAtClub?: boolean;
  hasCredentialDocument: boolean;
  hasIdentificationDocument: boolean;
};

export function BecomeCoachRequestForm({
  initialBio,
  initialEvidence,
  initialAlreadyAtClub,
  hasCredentialDocument,
  hasIdentificationDocument,
}: BecomeCoachRequestFormProps) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio?.trim() ?? "");
  const [evidence, setEvidence] = useState(initialEvidence?.trim() ?? "");
  const [atClub, setAtClub] = useState(Boolean(initialAlreadyAtClub));
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [pending, start] = useTransition();
  const [uploadClearTick, setUploadClearTick] = useState(0);

  useEffect(() => {
    setBio(initialBio?.trim() ?? "");
    setEvidence(initialEvidence?.trim() ?? "");
    setAtClub(Boolean(initialAlreadyAtClub));
  }, [initialBio, initialEvidence, initialAlreadyAtClub]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("bio", bio.trim());
    fd.set("evidence", evidence.trim());
    fd.set("already_at_club", atClub ? "true" : "false");

    start(async () => {
      const r = await submitCoachListingApplication(fd);
      if ("error" in r) {
        setMsgTone("error");
        setMsg(r.error ?? "Something went wrong.");
        return;
      }
      setMsgTone("success");
      setMsg(
        "Thanks — we have your application. Our team will review it; once you are approved, you can publish sessions on the Verification page.",
      );
      setUploadClearTick((t) => t + 1);
      router.refresh();
    });
  }

  const bioOk = bio.trim().length >= 20;
  const needCred = !hasCredentialDocument;
  const needId = !hasIdentificationDocument;
  const submitEnabled = bioOk;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="space-y-2">
        <Label htmlFor="coach-bio-req">About your coaching</Label>
        <Textarea
          id="coach-bio-req"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          required
          minLength={20}
          placeholder="Years coaching padel, levels you work with, cities or clubs, languages you speak, and what you enjoy teaching."
          className="min-h-[120px] resize-y"
        />
        <p className="text-xs text-muted-foreground">
          At least 20 characters — helps us match you with the right players.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="coach-evidence-req">Extra details (optional)</Label>
        <Input
          id="coach-evidence-req"
          name="evidence"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Federation numbers, course names, or links we should read"
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
        <Checkbox
          id="coach-at-club"
          checked={atClub}
          onCheckedChange={(v) => setAtClub(v === true)}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <Label htmlFor="coach-at-club" className="cursor-pointer text-sm font-medium leading-snug">
            I already coach at a padel club
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional — tick this if you are on staff or regularly coach at a venue today.
          </p>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="credential_document" className="inline-flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden />
            Proof of credentials
          </Label>
          <p className="text-xs text-muted-foreground">
            Certificate scan, coaching qualification, or federation letter.
          </p>
          <CoachDocumentDropzone
            id="credential_document"
            name="credential_document"
            required={needCred}
            hasExistingServerFile={hasCredentialDocument}
            groupAriaLabel="Proof of coaching credentials — drag a file or browse"
            clearStagedSignal={uploadClearTick}
            serverFileHint="We already have a credentials file on file — upload again only if you want to replace it."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="identification_document" className="inline-flex items-center gap-2">
            <IdCard className="size-4 text-primary" aria-hidden />
            Proof of identification
          </Label>
          <p className="text-xs text-muted-foreground">
            Passport or government ID (you may cover sensitive numbers if the name and photo are
            clear).
          </p>
          <CoachDocumentDropzone
            id="identification_document"
            name="identification_document"
            required={needId}
            hasExistingServerFile={hasIdentificationDocument}
            groupAriaLabel="Proof of identification — drag a file or browse"
            clearStagedSignal={uploadClearTick}
            serverFileHint="We already have an ID document on file — upload again only if you want to replace it."
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Files are stored securely. Only you can upload to your folder; LobSmash staff review
        applications when approving coaches.
      </p>

      {msg ? (
        <p
          className={
            msgTone === "error"
              ? "text-sm font-medium text-destructive"
              : "text-sm text-muted-foreground"
          }
          role={msgTone === "error" ? "alert" : "status"}
        >
          {msg}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !submitEnabled}
        className="h-11 min-h-[44px] w-full sm:w-auto sm:min-w-[200px]"
      >
        {pending ? "Sending…" : "Submit application"}
      </Button>
    </form>
  );
}
