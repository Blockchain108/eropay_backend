const personal_kyc = (sequelize, DataTypes) => {
    const Personal_kyc = sequelize.define('tbl_personal_kycs', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        partner_id: {
            type: DataTypes.STRING
        },
        additional_name: {                        // string	Middle name or other additional name
            type: DataTypes.STRING
        },
        address_country_code: {                   // country code	country code for current address
            type: DataTypes.STRING
        },
        state_or_province: {                      // string	name of state/province/region/prefecture
            type: DataTypes.STRING
        },
        city: {                                   // string	name of city/town
            type: DataTypes.STRING
        },
        postal_code: {                            // string	Postal or other code identifying user's locale
            type: DataTypes.STRING
        },
        address: {                                // string	Entire address (country, state, postal code, street address, etc...) as a multi-line string
            type: DataTypes.STRING
        },
        mobile_number: {                          // phone number	Mobile phone number with country code, in E.164 format
            type: DataTypes.STRING
        },
        email_address: {                          // string	Email address
            type: DataTypes.STRING
        },
        birth_date: {                             // date	Date of birth, e.g. 1976-07-04
            type: DataTypes.STRING
        },
        birth_place: {                            // date	Place of birth (city, state, country; as on passport)
            type: DataTypes.STRING
        },
        birth_country_code: {                     // country code	ISO Code of country of birth
            type: DataTypes.STRING
        },
        bank_account_number: {                    // string	Number identifying bank account
            type: DataTypes.STRING
        },
        bank_number: {                            // string	Number identifying bank in national banking system (routing number in US)
            type: DataTypes.STRING
        },
        bank_phone_number: {                      // string	Phone number with country code for bank
            type: DataTypes.STRING
        },
        bank_branch_number: {                     // string	Number identifying bank branch
            type: DataTypes.STRING
        },
        tax_id: {                                 // string	Tax identifier of user in their country (social security number in US)
            type: DataTypes.STRING
        },
        tax_id_name: {                            // string	Name of the tax ID (SSN or ITIN in the US)
            type: DataTypes.STRING
        },
        occupation: {                             // number	Occupation ISCO code
            type: DataTypes.STRING
        },
        employer_name: {                          // string	Name of employer
            type: DataTypes.STRING
        },
        employer_address: {                       // string	Address of employer
            type: DataTypes.STRING
        },
        language_code: {                          // language code	primary language
            type: DataTypes.STRING
        },
        id_type: {                                // string	passport, drivers_license, id_card, etc...
            type: DataTypes.STRING
        },
        id_country_code: {                        // country code	country issuing passport or photo ID as ISO 3166-1 alpha-3 code
            type: DataTypes.STRING
        },
        id_issue_date: {                          // date	ID issue date
            type: DataTypes.STRING
        },
        id_expiration_date: {                     // date	ID expiration date
            type: DataTypes.STRING
        },
        id_number: {                              // string	Passport or ID number
            type: DataTypes.STRING
        },
        photo_id_front: {                         // binary	Image of front of user's photo ID or passport
            type: DataTypes.STRING
        },
        photo_id_back: {                          // binary	Image of back of user's photo ID or passport
            type: DataTypes.STRING
        },
        notary_approval_of_photo_id: {            // binary	Image of notary's approval of photo ID or passport
            type: DataTypes.STRING
        },
        ip_address: {                             // string	IP address of customer's computer
            type: DataTypes.STRING
        },
        photo_proof_residence: {                  // binary	Image of a utility bill, bank statement or similar with the user's name and address
            type: DataTypes.STRING
        },
        passbase: {                               // boolean Check flag true or false
            type: DataTypes.STRING
        },
        identityAccessKey: {                     // identityAccessKey for passbase
            type: DataTypes.STRING
        },
    },{
        timestamps : false,
        freezeTableName: true
      });

    return Personal_kyc;
};

module.exports = personal_kyc;