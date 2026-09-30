/** Risposte di esempio nel formato reale di Google Books (ridotte). */
export const GB_SEARCH_DUNE = {
	items: [
		{
			id: 'B1hSG45JCX4C',
			volumeInfo: {
				title: 'Dune',
				authors: ['Frank Herbert'],
				publisher: 'Mondadori',
				publishedDate: '2017-05-09',
				pageCount: 688,
				language: 'it',
				industryIdentifiers: [
					{ type: 'ISBN_13', identifier: '9788804678106' },
					{ type: 'ISBN_10', identifier: '8804678100' }
				],
				imageLinks: {
					thumbnail:
						'http://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api'
				}
			}
		},
		{
			id: 'zzzNoIsbn1',
			volumeInfo: {
				title: 'Dune: Edizione speciale',
				publisher: 'Editore senza ISBN',
				industryIdentifiers: [{ type: 'OTHER', identifier: 'PKEY:1234' }],
				imageLinks: { smallThumbnail: 'https://evil.example.com/cover.jpg' }
			}
		},
		{ id: 'broken' }
	]
};
