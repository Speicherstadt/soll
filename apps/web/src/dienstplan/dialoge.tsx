import { Match, Switch } from "solid-js";
import { AngabenDialog } from "./angabenDialog.tsx";
import { BedarfDialog } from "./bedarfDialog.tsx";
import { SchichtDialog, type SchichtModus } from "./schichtDialog.tsx";
import type { Planperson, Vorlage } from "./typen.ts";
import { VorlagenDialog } from "./vorlagenDialog.tsx";

/** Which dialog of the plan is open */
export type OffenerDialog =
  | { art: "schicht"; modus: SchichtModus }
  | { art: "vorlagen" }
  | { art: "bedarf" }
  | { art: "angaben" }
  | null;

/** The dialogs of the plan: a shift, the templates, the need of the site, the data of a person */
export const PlanDialoge = (props: {
  offen: OffenerDialog;
  standortId: string;
  personen: readonly Planperson[];
  vorlagen: readonly Vorlage[];
  rollen: readonly string[];
  onSchliessen: () => void;
  onPlanGeaendert: () => void;
  onVorlagenGeaendert: () => void;
}) => {
  const modus = () => (props.offen?.art === "schicht" ? props.offen.modus : null);
  return (
    <Switch>
      <Match when={modus()}>
        {(gewaehlt) => (
          <SchichtDialog
            modus={gewaehlt()}
            standortId={props.standortId}
            personen={props.personen}
            vorlagen={props.vorlagen}
            rollen={props.rollen}
            onSchliessen={props.onSchliessen}
            onGespeichert={props.onPlanGeaendert}
          />
        )}
      </Match>
      <Match when={props.offen?.art === "vorlagen"}>
        <VorlagenDialog
          vorlagen={props.vorlagen}
          onSchliessen={props.onSchliessen}
          onGeaendert={props.onVorlagenGeaendert}
        />
      </Match>
      <Match when={props.offen?.art === "bedarf"}>
        <BedarfDialog
          standortId={props.standortId}
          rollen={props.rollen}
          onSchliessen={props.onSchliessen}
          onGeaendert={props.onPlanGeaendert}
        />
      </Match>
      <Match when={props.offen?.art === "angaben"}>
        <AngabenDialog
          personen={props.personen}
          onSchliessen={props.onSchliessen}
          onGespeichert={props.onPlanGeaendert}
        />
      </Match>
    </Switch>
  );
};
