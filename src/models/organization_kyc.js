const organization_kyc = (sequelize, DataTypes) => {
    const Organization_kyc = sequelize.define('tbl_organization_kycs', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        partner_id: {                                 // string	user id of organization
            type: DataTypes.STRING
        },
        organization_name: {                         // string	Full organiation name as on the incorporation papers
            type: DataTypes.STRING
        },
        organization_VAT_number: {                   // string	Organization VAT number
            type: DataTypes.STRING
        },
        organization_registration_number: {          // string	Organization registration number
            type: DataTypes.STRING
        },
        organization_registered_address: {           // string	Organization registered address
            type: DataTypes.STRING
        },
        organization_number_of_shareholders: {       // number	Organization shareholder number
            type: DataTypes.STRING
        },
        organization_shareholder_name: {             // string	Can be an organization or a person and should be queried recursively up to the ultimate beneficial owners (with KYC information for natural persons such as above)
            type: DataTypes.STRING
        },
        organization_photo_incorporation_doc: {      // string	Image of incorporation documents
            type: DataTypes.STRING
        },
        organization_photo_proof_adress: {           // string	Image of a utility bill, bank statement with the organization's name and address
            type: DataTypes.STRING
        },
        organization_address_country_code: {         // country code	country code for current address
            type: DataTypes.STRING
        },
        organization_state_or_province: {            // string	name of state/province/region/prefecture
            type: DataTypes.STRING
        },
        organization_city: {                         // string	name of city/town
            type: DataTypes.STRING
        },
        organization_postal_code: {                  // string	Postal or other code identifying organization's locale
            type: DataTypes.STRING
        },
        organization_director_name: {                // string	Organization registered managing director (the rest of the information should be queried as an individual using the fields above)
            type: DataTypes.STRING
        },
        organization_website: {                      // string	Organization website
            type: DataTypes.STRING
        },
        organization_email: {                        // string	Organization contact email
            type: DataTypes.STRING
        },
        organization_phone: {                        // string	Organization contact phone
            type: DataTypes.STRING
        },
        passbase: {                                 // string	Organization contact phone
            type: DataTypes.STRING
        },
    },{
        timestamps : false,
        freezeTableName: true
      });

    return Organization_kyc;
};

module.exports = organization_kyc;