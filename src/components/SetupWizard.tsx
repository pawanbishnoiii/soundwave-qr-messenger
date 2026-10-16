import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Eye, Rocket, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SeedWorkspaceButton } from "./SeedWorkspaceButton";
import { useTeam } from "@/lib/auth";

const KEY = "bnoy-admin-setup-done";

/** First-time admin setup: seed demo data, preview role dashboards, add the team. */
export function SetupWizard() {
  const { data: team = [] } = useTeam();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { if (!localStorage.getItem(KEY)) setOpen(true); }, []);
  const finish = () => { localStorage.setItem(KEY, "1"); setOpen(false); };
  const seeded = team.length > 1;

  const steps = [
    { icon: Rocket, title: "Welcome, admin", body: <p>You're the first account, so you run this workspace. Let's get it ready in three quick steps.</p> },
    { icon: CheckCircle2, title: "Seed the demo workspace", body: <div className="space-y-3"><p>Create a sample distributor, manager and riders with demo parcels so you can try every flow.</p><SeedWorkspaceButton />{seeded && <p className="text-sm font-semibold text-success">Team ready — {team.length - 1} members.</p>}</div> },
    { icon: Eye, title: "Review role dashboards", body: <p>On your dashboard, use <b>View dashboard as</b> at the top to preview exactly what each distributor, manager or rider sees.</p> },
    { icon: Users, title: "Set up your real team", body: <div className="space-y-3"><p>Add people by mobile number and place them under the right manager. New sign-ups join as riders automatically; you can change roles anytime.</p><Button asChild variant="outline" onClick={finish}><Link to="/team">Open Team</Link></Button></div> },
  ];
  const s = steps[step]!;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><s.icon className="h-5 w-5 text-primary" /> {s.title}</DialogTitle></DialogHeader>
        <div className="flex gap-1">{steps.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}</div>
        <div className="text-sm text-muted-foreground">{s.body}</div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={step ? () => setStep(step - 1) : finish}>{step ? "Back" : "Skip"}</Button>
          {step < steps.length - 1 ? <Button onClick={() => setStep(step + 1)}>Next</Button> : <Button onClick={finish}>Finish</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
