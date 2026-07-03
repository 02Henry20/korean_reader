function buildGrammarLibraryEntries() {
  if (state.grammarLibraryEntries) return state.grammarLibraryEntries;
  const entries = [];
  state.stories.forEach((story) => {
    story.paragraphs.forEach((paragraph, paragraphIndex) => {
      paragraph.sentences.forEach((sentence, sentenceIndex) => {
        (sentence.grammar || []).forEach((item, grammarIndex) => {
          const grammar = normalizeGrammarItem(item, sentence);
          entries.push({
            id: `${story.id}-${paragraphIndex}-${sentenceIndex}-${grammarIndex}`,
            story,
            sentence,
            grammar,
            searchText: normalizeSearchText([
              grammar.pattern,
              grammar.fragment,
              grammar.baseForm,
              grammar.transformation,
              grammar.suffix,
              grammar.result,
              grammar.meaning,
              grammar.explanation,
              grammar.why,
              grammar.nuance,
              grammar.limitations,
              ...grammar.examples,
              story.title,
              story.englishTitle,
              story.level,
              story.author
            ].join(" "))
          });
        });
      });
    });
  });
  state.grammarLibraryEntries = entries.sort((a, b) =>
    (a.grammar.pattern || a.grammar.fragment || a.story.title)
      .localeCompare(b.grammar.pattern || b.grammar.fragment || b.story.title, undefined, {numeric: true})
  );
  return state.grammarLibraryEntries;
}

function renderGrammarLibrary(filter = "") {
  applyTheme(state.settings.theme);
  const query = normalizeSearchQuery(filter);
  grammarGrid.replaceChildren();
  grammarSearchScopeLabel.textContent = query
    ? `Scope: grammar entries only · Searching for “${filter.trim()}”`
    : "Scope: grammar entries only";

  const entries = buildGrammarLibraryEntries()
    .filter((entry) => !query || entry.searchText.includes(query));

  if (!entries.length) {
    grammarGrid.appendChild(createTextBlock("div", "empty-state", "No matching grammar entries were found."));
    return;
  }

  entries.forEach((entry) => grammarGrid.appendChild(createGrammarLibraryCard(entry)));
}

function createGrammarLibraryCard(entry) {
  const card = document.createElement("article");
  card.className = "grammar-library-card";

  const heading = entry.grammar.pattern || entry.grammar.fragment || "Grammar entry";
  card.appendChild(createTextBlock("p", "grammar-library-pattern", heading));
  if (entry.grammar.fragment && entry.grammar.fragment !== heading) {
    card.appendChild(createTextBlock("p", "grammar-library-fragment", entry.grammar.fragment));
  }
  if (entry.grammar.meaning) card.appendChild(createTextBlock("p", "grammar-library-meaning", entry.grammar.meaning));
  if (entry.grammar.explanation) card.appendChild(createTextBlock("p", "grammar-library-explanation", entry.grammar.explanation));

  const sourceButton = document.createElement("button");
  sourceButton.type = "button";
  sourceButton.className = "grammar-source-button";
  sourceButton.textContent = `${entry.story.title}${entry.story.level ? ` · ${entry.story.level}` : ""}`;
  sourceButton.addEventListener("click", () => openStory(entry.story, true));
  card.appendChild(sourceButton);
  return card;
}
