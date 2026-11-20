/*
 * Pattern page of packages/ui for the Playwright tests (e2e/ui.spec.ts): served by the dev server at
 * /muster.html, never part of the build (vite builds index.html only). `?theme=dark` and `?dir=rtl`
 * switch the look; the texts here are sample data, not app texts.
 */
import { render } from "@solidjs/web";
import {
  Badge,
  Button,
  Combobox,
  Dialog,
  Icon,
  Input,
  Menu,
  Popover,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  ToastBereich,
  Tooltip,
  Tr,
  useToast,
} from "@soll/ui";
import { Clock, Settings } from "lucide";
import { createSignal } from "solid-js";
import "../src/styles.css";

const parameter = new URLSearchParams(location.search);
document.documentElement.dataset.theme = parameter.get("theme") === "dark" ? "dark" : "light";
document.documentElement.dir = parameter.get("dir") === "rtl" ? "rtl" : "ltr";

const ToastKnopf = () => {
  const toast = useToast();
  return (
    <Button variant="outline" onClick={() => toast.zeigen("Gespeichert", "success")}>
      Toast zeigen
    </Button>
  );
};

const Muster = () => {
  const [dialogOffen, setDialogOffen] = createSignal(false);
  const [gewaehlt, setGewaehlt] = createSignal("");
  const [menuWahl, setMenuWahl] = createSignal("");
  return (
    <ToastBereich label="Meldungen">
      <main class="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <h1 class="font-semibold text-[28px]">Komponenten</h1>
        <section data-testid="button" class="flex flex-wrap items-center gap-2">
          <h2 class="w-full font-semibold">Button</h2>
          <Button>Kommen</Button>
          <Button variant="outline">Abbrechen</Button>
          <Button variant="ghost">Mehr</Button>
          <Button variant="icon" aria-label="Einstellungen">
            <Icon icon={Settings} />
          </Button>
          <Button disabled>Gesperrt</Button>
        </section>
        <section data-testid="badge" class="flex gap-2">
          <h2 class="w-full font-semibold">Badge</h2>
          <Badge>Neutral</Badge>
          <Badge ton="success">Geprüft</Badge>
          <Badge ton="warning">Hinweis</Badge>
          <Badge ton="danger">Verstoß</Badge>
        </section>
        <section data-testid="input">
          <h2 class="font-semibold">Input</h2>
          <Input label="Beginn" hinweis="Etwa 7:30" />
          <Input label="Pause" fehler="Pause fehlt noch 15 min · § 4 ArbZG" value="15 min" />
        </section>
        <section data-testid="dialog">
          <h2 class="font-semibold">Dialog</h2>
          <Button variant="outline" onClick={() => setDialogOffen(true)}>
            Dialog öffnen
          </Button>
          <Dialog
            offen={dialogOffen()}
            titel="Monat bestätigen"
            onSchliessen={() => setDialogOffen(false)}
            aktionen={<Button onClick={() => setDialogOffen(false)}>Bestätigen</Button>}
          >
            <p>Der Monat wird danach gesperrt.</p>
          </Dialog>
        </section>
        <section data-testid="popover">
          <h2 class="font-semibold">Popover</h2>
          <Popover ausloeser="Details">
            <p>Soll 8:00, Ist 7:45</p>
          </Popover>
        </section>
        <section data-testid="menu">
          <h2 class="font-semibold">Menü</h2>
          <Menu
            ausloeser="Aktionen"
            eintraege={[
              { label: "Bearbeiten", onWaehlen: () => setMenuWahl("Bearbeiten") },
              { label: "Kopieren", onWaehlen: () => setMenuWahl("Kopieren") },
              { label: "Löschen", onWaehlen: () => setMenuWahl("Löschen"), gefaehrlich: true },
            ]}
          />
          <output data-testid="menu-wahl">{menuWahl()}</output>
        </section>
        <section data-testid="tooltip">
          <h2 class="font-semibold">Tooltip</h2>
          <Tooltip text="Laufende Zeit">
            <Button variant="icon" aria-label="Uhr">
              <Icon icon={Clock} />
            </Button>
          </Tooltip>
        </section>
        <section data-testid="toast">
          <h2 class="font-semibold">Toast</h2>
          <ToastKnopf />
        </section>
        <section data-testid="combobox">
          <h2 class="font-semibold">Combobox</h2>
          <Combobox
            label="Person"
            leer="Niemand gefunden"
            optionen={[
              { wert: "anna", label: "Anna" },
              { wert: "max", label: "Max" },
              { wert: "sandra", label: "Sandra" },
            ]}
            onWaehlen={setGewaehlt}
          />
          <output data-testid="combobox-wahl">{gewaehlt()}</output>
        </section>
        <section data-testid="tabs">
          <h2 class="font-semibold">Tabs</h2>
          <Tabs
            label="Zeitraum"
            tabs={[
              { id: "tag", label: "Tag", inhalt: () => <p>Heute</p> },
              { id: "woche", label: "Woche", inhalt: () => <p>Diese Woche</p> },
              { id: "monat", label: "Monat", inhalt: () => <p>Dieser Monat</p> },
            ]}
          />
        </section>
        <section data-testid="table">
          <h2 class="font-semibold">Tabelle</h2>
          <Table beschriftung="Zeiten">
            <Thead>
              <Tr>
                <Th aria-sort="ascending">Tag</Th>
                <Th>Dauer</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>Mo</Td>
                <Td class="font-mono">7:30</Td>
              </Tr>
            </Tbody>
          </Table>
        </section>
      </main>
    </ToastBereich>
  );
};

const root = document.getElementById("app");
if (root) render(() => <Muster />, root);
