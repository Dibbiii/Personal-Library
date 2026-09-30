/** Risposte di esempio nel formato reale di Open Library (ridotte). */
export const OL_SEARCH_DUNE = {
	numFound: 2,
	docs: [
		{
			author_key: ['OL79034A'],
			author_name: ['Frank Herbert'],
			cover_i: 11481354,
			first_publish_year: 1965,
			key: '/works/OL893414W',
			language: ['fre', 'eng', 'ita'],
			title: 'Dune',
			editions: {
				numFound: 1,
				docs: [
					{
						key: '/books/OL51711708M',
						title: 'Dune. Il ciclo di Dune',
						cover_i: 15244725,
						language: ['ita'],
						publisher: ['Fanucci'],
						publish_date: ['Nov 14, 2019'],
						isbn: ['9788834739679', '8834739671']
					}
				]
			}
		},
		{
			author_key: ['OL79034A'],
			author_name: ['Frank Herbert'],
			key: '/works/OL893461W',
			title: 'Dune Messiah',
			editions: { numFound: 1, docs: [{ key: '/books/OL7525229M', title: 'Dune Messiah' }] }
		},
		{ broken: true }
	]
};

export const OL_SEARCH_ISBN = {
	numFound: 1,
	docs: [
		{
			author_name: ['Frank Herbert'],
			cover_i: 11481354,
			key: '/works/OL893414W',
			title: 'Dune',
			editions: {
				docs: [
					{
						key: '/books/OL17952222M',
						title: 'Dune',
						cover_i: 14856017,
						language: ['eng'],
						publisher: ['Ace Books'],
						publish_date: ['2005'],
						isbn: ['0441013597', '9780441013593']
					}
				]
			}
		}
	]
};

export const OL_EDITION_JSON = {
	key: '/books/OL7524304M',
	title: 'Dune',
	number_of_pages: 544,
	publishers: ['Ace Trade'],
	publish_date: 'August 2, 2005',
	isbn_10: ['0441013597'],
	isbn_13: ['9780441013593'],
	covers: [14565843, 284314],
	languages: [{ key: '/languages/eng' }],
	works: [{ key: '/works/OL893414W' }]
};
