create table examples
(
	id serial,
	session int,
	timestamp timestamptz,
	client varchar,
	image_url varchar,
	image_index int,
	mode varchar,
	score int not null
);

create unique index examples_id_uindex
	on examples (id);

create unique index examples_image_url_uindex
	on examples (image_url);

alter table examples
	add constraint examples_pk
		primary key (id);

