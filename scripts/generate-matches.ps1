# Generiert src/data/matches.ts aus dem offiziellen FIFA-Kalender (WM 2026).
# Einmalig/bei Bedarf ausfuehren: powershell -File scripts/generate-matches.ps1
$ErrorActionPreference = "Stop"

$url = "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=de&count=200"
$data = Invoke-RestMethod -Uri $url -TimeoutSec 60

$teamIdByCode = @{
  MEX="mex"; RSA="rsa"; KOR="kor"; CZE="cze"; CAN="can"; SUI="sui"; QAT="qat"; BIH="bih";
  BRA="bra"; MAR="mar"; HAI="hai"; SCO="sco"; USA="usa"; PAR="par"; AUS="aus"; TUR="tur";
  GER="ger"; CUW="cuw"; CIV="civ"; ECU="ecu"; NED="ned"; JPN="jpn"; TUN="tun"; SWE="swe";
  BEL="bel"; EGY="egy"; IRN="irn"; NZL="nzl"; ESP="esp"; CPV="cpv"; KSA="ksa"; URU="uru";
  FRA="fra"; SEN="sen"; NOR="nor"; IRQ="irq"; ARG="arg"; ALG="alg"; AUT="aut"; JOR="jor";
  POR="por"; UZB="uzb"; COL="col"; COD="cod"; ENG="eng"; CRO="cro"; GHA="gha"; PAN="pan"
}
$countryByCode = @{ USA = "USA"; CAN = "Kanada"; MEX = "Mexiko" }
$roundByStage = @{
  "Erste Phase" = "Gruppenphase";
  "Sechzehntelfinale" = "Sechzehntelfinale";
  "Achtelfinale" = "Achtelfinale";
  "Viertelfinale" = "Viertelfinale";
  "Halbfinale" = "Halbfinale";
  "Spiel um Platz drei" = "Spiel um Platz 3";
  "Finale" = "Finale"
}

function Resolve-TeamId($side, $placeholder) {
  if ($side -and $side.Abbreviation -and $teamIdByCode.ContainsKey($side.Abbreviation)) {
    return $teamIdByCode[$side.Abbreviation]
  }
  if ($placeholder) { return $placeholder.ToLower() }
  return "tbd"
}

$lines = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

$sorted = $data.Results | Sort-Object MatchNumber
foreach ($m in $sorted) {
  $stage = $m.StageName[0].Description
  $round = $roundByStage[$stage]
  if (-not $round) { $warnings.Add("Unbekannte Runde: $stage (Spiel $($m.MatchNumber))"); $round = "Gruppenphase" }

  $group = $null
  if ($round -eq "Gruppenphase" -and $m.GroupName -and $m.GroupName.Count -gt 0) {
    # FIFA liefert "Gruppe X" mit geschuetztem Leerzeichen -> nur den Buchstaben extrahieren.
    $group = ($m.GroupName[0].Description).Substring(($m.GroupName[0].Description).Length - 1)
  }

  $teamA = Resolve-TeamId $m.Home $m.PlaceHolderA
  $teamB = Resolve-TeamId $m.Away $m.PlaceHolderB
  $stadium = $m.Stadium.Name[0].Description
  $city = $m.Stadium.CityName[0].Description
  $country = $countryByCode[$m.Stadium.IdCountry]
  if (-not $country) { $warnings.Add("Unbekanntes Land: $($m.Stadium.IdCountry) (Spiel $($m.MatchNumber))"); $country = "USA" }

  $groupPart = ""
  if ($group) { $groupPart = ", group: `"$group`"" }
  $lines.Add("  { id: $($m.MatchNumber), round: `"$round`"$groupPart, dateUtc: `"$($m.Date)`", teamAId: `"$teamA`", teamBId: `"$teamB`", stadium: `"$stadium`", city: `"$city`", country: `"$country`" },")
}

$header = @'
// AUTOGENERIERT aus dem offiziellen FIFA-Kalender (api.fifa.com, Saison 285023).
// Neu erzeugen mit: powershell -File scripts/generate-matches.ps1
// Ergebnisse/Status kommen zur Laufzeit von der FIFA-API – diese Datei ist der statische Spielplan (Offline-Fallback).
import type { GroupId, Match, Round } from "../types";

type MatchSeed = {
  id: number;
  round: Round;
  dateUtc: string;
  teamAId: string;
  teamBId: string;
  stadium: string;
  city: string;
  country: string;
  group?: GroupId;
};

const groupName = (group?: GroupId) => (group ? `Gruppe ${group}` : undefined);

const makeMatch = (seed: MatchSeed): Match => ({
  id: `match-${String(seed.id).padStart(3, "0")}`,
  round: seed.round,
  group: seed.group,
  groupName: groupName(seed.group),
  dateUtc: seed.dateUtc,
  teamAId: seed.teamAId,
  teamBId: seed.teamBId,
  stadium: seed.stadium,
  city: seed.city,
  country: seed.country,
  status: "scheduled",
  scoreA: null,
  scoreB: null,
  liveMinute: null,
});

const matchSeeds: MatchSeed[] = [
'@

$footer = @'
];

export const matches: Match[] = matchSeeds.map(makeMatch);
'@

$content = $header + "`n" + ($lines -join "`n") + "`n" + $footer + "`n"
# Fix: group muss als GroupId-Literal stehen, TS akzeptiert den String direkt.
[System.IO.File]::WriteAllText("$PSScriptRoot\..\src\data\matches.ts", $content, (New-Object System.Text.UTF8Encoding($false)))

"Geschrieben: $($sorted.Count) Spiele"
if ($warnings.Count -gt 0) { "WARNUNGEN:"; $warnings }
